#!/usr/bin/env bash
# Run by GitHub on the emulator after ci-youtube.sh, never stopping the release unless the app's bridge is found in
# Twitter's page (Twitter is outside: it may refuse the emulator or ask to sign in): «تويتر» (v166). The test build opens
# Twitter from its page (WaiNative.openX); the phone's log says what Twitter's page holds (its place, that the app's
# bridge is not there, x_calm.js); with a small picture between XSHOT lines.
set -u
note() { echo "::warning::x: $*"; }
adb shell am start -W -n app.mohanndj.alwaei/.MainActivity > /dev/null
sleep 5
PID=$(adb shell pidof app.mohanndj.alwaei | tr -d '\r')
[ -n "$PID" ] || { note "the app did not start"; exit 0; }
adb forward tcp:9224 "localabstract:webview_devtools_remote_$PID" > /dev/null || { note "no debugging address"; exit 0; }
WS=""
for i in $(seq 1 10); do
  WS=$(curl -s -m 5 localhost:9224/json | python3 -c "import sys,json; print([p for p in json.load(sys.stdin) if 'mohanndj' in p.get('url','')][0]['webSocketDebuggerUrl'])" 2>/dev/null)
  [ -n "$WS" ] && break
  sleep 3
done
[ -n "$WS" ] || { note "the page's debugging is not open"; exit 0; }
echo "the page: openX is $(python3 android/ci-cdp.py "$WS" 'typeof WaiNative.openX')"
adb logcat -c
python3 android/ci-cdp.py "$WS" 'WaiNative.openX(), 1' > /dev/null
sleep 40
LOG=$(adb logcat -d -s WaiX:* | grep -E 'open|page ' | tail -4)
echo "$LOG"
echo "the app's page with Twitter open: $(python3 android/ci-cdp.py "$WS" 'document.visibilityState')"
# (what Twitter's sign-in page holds: our classes and line, its buttons and frames, and what is on top at its top)
XT=$(curl -s -m 5 localhost:9224/json | python3 -c "import sys,json; print([p for p in json.load(sys.stdin) if 'x.com' in p.get('url','')][0]['webSocketDebuggerUrl'])" 2>/dev/null)
if [ -n "$XT" ]; then
  echo "Twitter's page: $(python3 android/ci-cdp.py "$XT" "(function(){var s=document.getElementById('wai-xsign'),r=s&&s.getBoundingClientRect(),top=document.elementFromPoint(innerWidth/2,15),under=document.elementFromPoint(innerWidth/2,60);return JSON.stringify({path:location.pathname,cls:document.documentElement.className,x:window.__waiX,sign:s?{in:s.isConnected,first:document.body.firstChild===s,disp:getComputedStyle(s).display,y:r.top,h:r.height}:null,top:top?top.tagName+'#'+top.id+'.'+String(top.className).slice(0,40):null,under:under?under.tagName+':'+(under.textContent||'').trim().slice(0,30):null,btns:[].slice.call(document.querySelectorAll('button,[role=button],a')).map(function(b){return b.tagName+':'+(b.textContent||'').trim().slice(0,30)+(b.classList.contains('wai-x-gone')?' (gone)':'')}).slice(0,15),frames:[].slice.call(document.querySelectorAll('iframe')).map(function(f){return (f.src||'').slice(0,60)}),shadow:[].slice.call(document.querySelectorAll('*')).filter(function(e){return e.shadowRoot}).length})})()")"
  # (what stands where the Google button is seen, a third of the way down: it and the boxes around it)
  echo "Twitter's Google button: $(python3 android/ci-cdp.py "$XT" "(function(){var out=[];for(var y=150;y<=300;y+=30){var e=document.elementFromPoint(innerWidth/2,y),c=[];for(var k=0;e&&k<6;k++,e=e.parentElement){var cs=getComputedStyle(e);c.push(e.tagName+(e.id?'#'+e.id:'')+'.'+String(e.className).slice(0,30)+'['+cs.display+','+cs.position+']'+(e.tagName==='IFRAME'?'{'+(e.src||'').slice(0,40)+'}':''))}out.push(y+': '+c.join(' < '))}return JSON.stringify({w:innerWidth,h:innerHeight,at:out,frames:[].slice.call(document.querySelectorAll('iframe')).map(function(f){var r=f.getBoundingClientRect();return (f.src||'(none)').slice(0,40)+' '+getComputedStyle(f).display+' '+Math.round(r.top)+'x'+Math.round(r.height)+' '+(f.parentElement?f.parentElement.className.slice(0,30):'')})})})()")"
else note "no debugging address for Twitter's page"; fi
if echo "$LOG" | grep -q 'bridge\\":\\"' && ! echo "$LOG" | grep -q 'bridge\\":\\"undefined'; then echo "::error::x: the app's bridge is in Twitter's page"; exit 1; fi
echo "$LOG" | grep -q 'page ' || note "Twitter's page was not reached"
echo "$LOG" | grep -q 'calm\\":{' || note "the calm script is not in Twitter's page"
adb exec-out screencap -p > x.png
python3 - <<'PY'
import base64, io
from PIL import Image
im = Image.open("x.png").convert("RGB"); im.thumbnail((360, 720))
b = io.BytesIO(); im.save(b, "JPEG", quality=60)
print("XSHOT " + base64.b64encode(b.getvalue()).decode())
PY
# (v173: the floating button back to the app: shown over Twitter, a tap closes it)
adb shell uiautomator dump /sdcard/x.xml > /dev/null 2>&1; adb pull /sdcard/x.xml x.xml > /dev/null 2>&1 || : > x.xml
H=$(python3 - <<'PY'
import re
x = open("x.xml", encoding="utf-8").read()
m = re.search(r'content-desc="ارجع إلى الوعي الشخصي"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', x)
print("%d %d" % ((int(m[1]) + int(m[3])) // 2, (int(m[2]) + int(m[4])) // 2) if m else "")
PY
)
echo "the button back to the app at: $H"
if [ -n "$H" ]; then
  adb logcat -c; adb shell input tap $H; sleep 3
  adb logcat -d -s WaiX:* | grep -q 'home button' && adb logcat -d -s WaiX:* | grep -q 'closed' && echo "the button back to the app: Twitter closed" || note "the button back to the app did not close Twitter"
  python3 android/ci-cdp.py "$WS" 'WaiNative.openX(), 1' > /dev/null; sleep 15
else note "no button back to the app over Twitter"; fi
adb logcat -c
adb shell input keyevent KEYCODE_BACK; sleep 2; adb shell input keyevent KEYCODE_BACK; sleep 2; adb shell input keyevent KEYCODE_BACK; sleep 2
adb logcat -d -s WaiX:* | grep -q 'closed' && echo "back: Twitter closed" || note "back did not close Twitter"
echo "x: checked"
