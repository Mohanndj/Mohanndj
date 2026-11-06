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
adb shell input keyevent KEYCODE_BACK; sleep 2; adb shell input keyevent KEYCODE_BACK; sleep 2; adb shell input keyevent KEYCODE_BACK; sleep 2
adb logcat -d -s WaiX:* | grep -q 'closed' && echo "back: Twitter closed" || note "back did not close Twitter"
echo "x: checked"
