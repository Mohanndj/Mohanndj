#!/usr/bin/env bash
# (a trial, on another branch only: the yellow highlight in «التوكيدات» with a real finger on the phone's own page)
set -u
say() { echo "AFF $*"; }
adb install -r app-debug.apk > /dev/null
adb shell am force-stop app.mohanndj.alwaei; sleep 2
adb shell am start -W -n app.mohanndj.alwaei/.MainActivity > /dev/null
PID=""; for i in $(seq 1 30); do sleep 2; PID=$(adb shell pidof app.mohanndj.alwaei | tr -d '\r'); [ -n "$PID" ] && break; done
sleep 15
adb forward tcp:9224 "localabstract:webview_devtools_remote_$PID" > /dev/null
WS=""; for i in $(seq 1 10); do WS=$(curl -s -m 5 localhost:9224/json | python3 -c "import sys,json; print([p for p in json.load(sys.stdin) if 'mohanndj' in p.get('url','')][0]['webSocketDebuggerUrl'])" 2>/dev/null); [ -n "$WS" ] && break; sleep 3; done
[ -n "$WS" ] || { say "no page"; exit 0; }
ev() { python3 android/ci-cdp.py "$WS" "$1"; }
shot() { adb exec-out screencap -p > af.png; python3 - "$1" <<'PY'
import base64, io, sys
from PIL import Image
im = Image.open("af.png").convert("RGB"); im.thumbnail((360, 720))
b = io.BytesIO(); im.save(b, "JPEG", quality=60)
print(sys.argv[1] + " " + base64.b64encode(b.getvalue()).decode())
PY
}
ev "(function(){S.settings.remShown=Date.now();S.settings.affTabs=[{id:'tA',name:'الطمأنينة'}];S.inspire=S.inspire.filter(function(x){return x.id!=='a1'});S.inspire.push(normalizeInspire({id:'a1',type:'affirmation',tab:'tA',text:'أنا في أمان تام\nوالله معي دائما'}));save();localStorage.setItem('mahami-aff',JSON.stringify({open:true,tab:'tA'}));inspUi.affSt=null;go('today');return 1})()"
sleep 2
ev "(function(){var b=document.querySelector('#view .aff-pen[data-v=a1]');if(!b)return 'no pen';b.click();return 'open'})()"
sleep 3
# every touch and what the selection was then, kept in the page
ev "(function(){var L=window.__al=[];function sel(){var s=getSelection();var el=document.getElementById('qText');return {txt:String(s),col:s.isCollapsed,in:!!(el&&s.anchorNode&&el.contains(s.anchorNode)),off:typeof qxSelOff==='function'?qxSelOff():null,range:qxRange,down:qxDown,hold:!!qxHold}}
['pointerdown','touchstart','touchend','mousedown','click','focusout','focusin'].forEach(function(n){document.addEventListener(n,function(e){var t=e.target;L.push({ev:n,t:(t.tagName||'')+(t.dataset&&(t.dataset.qcmd||t.dataset.qhi)||'')+(t.id?'#'+t.id:''),dp:e.defaultPrevented,s:sel()})},true)});
document.addEventListener('selectionchange',function(){L.push({ev:'sel',s:sel()})});return 1})()"
WV=$( (adb shell uiautomator dump /sdcard/af.xml > /dev/null 2>&1; adb pull /sdcard/af.xml af.xml > /dev/null 2>&1); python3 - <<'PY'
import re
x = open("af.xml", encoding="utf-8").read()
m = re.search(r'class="android.webkit.WebView"[^>]*bounds="\[(\d+),(\d+)\]', x)
print("%s %s" % (m[1], m[2]) if m else "0 0")
PY
)
say "webview at: $WV"
DPR=$(ev "devicePixelRatio")
say "dpr: $DPR"
# a point in the page to the screen
at() { python3 - "$WV" "$DPR" "$1" <<'PY'
import json, sys
ox, oy = map(int, sys.argv[1].split()); d = float(sys.argv[2]); p = json.loads(sys.argv[3])
print("%d %d" % (ox + p[0] * d, oy + p[1] * d))
PY
}
word() { ev "(function(){var p=document.querySelectorAll('#qText p')[$1];var t=document.createTreeWalker(p,NodeFilter.SHOW_TEXT).nextNode();var i=t.textContent.indexOf('$2');var r=document.createRange();r.setStart(t,i);r.setEnd(t,i+'$2'.length);var b=r.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2]})()"; }
btn() { ev "(function(){var b=document.querySelector('$1');if(!b)return [0,0];b.scrollIntoView({block:'nearest'});var r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()"; }
try() {
  local name=$1 line=$2 w=$3 tool=$4 sw=$5
  ev "window.__al.length=0, document.getElementById('qText').innerHTML" > /dev/null
  P=$(at "$(word $line $w)"); say "$name: long press at $P"
  adb shell input swipe $P $P 900; sleep 2
  say "$name: selected: $(ev "String(getSelection())")"
  shot "AFFSHOT_${name}_selected"
  T=$(at "$(btn "$tool")"); say "$name: tool at $T"; adb shell input tap $T; sleep 2
  if [ -n "$sw" ]; then shot "AFFSHOT_${name}_palette"; T=$(at "$(btn "$sw")"); say "$name: swatch at $T"; adb shell input tap $T; sleep 2; fi
  say "$name: html: $(ev "document.getElementById('qText').innerHTML")"
  say "$name: log: $(ev "JSON.stringify(window.__al)")"
  shot "AFFSHOT_${name}_after"
  adb shell input tap 5 5 > /dev/null 2>&1; sleep 1
}
try yellow 0 "أمان" '[data-qcmd="pal:hi"]' '#qPal [data-qhi="#fff3a3"]'
try bold 1 "معي" '[data-qcmd="bold"]' ''
ev "(function(){var p=document.getElementById('qPal');if(p)p.hidden=true;return 1})()" > /dev/null
try yellow2 1 "دائما" '[data-qcmd="pal:hi"]' '#qPal [data-qhi="#fff3a3"]'
say "done"; adb shell am force-stop app.mohanndj.alwaei; adb shell pm clear app.mohanndj.alwaei > /dev/null
