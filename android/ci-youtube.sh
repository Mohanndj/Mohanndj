#!/usr/bin/env bash
# Run by GitHub on the emulator after ci-alarm.sh, never stopping the release (YouTube is outside: it may refuse the
# emulator's address or change its pages): «يوتيوب» (v152). The test build of the app opens its YouTube window from its
# page (WaiNative.openYoutube), and the phone's log says what YouTube's page holds: its host, that the app's bridge is
# not there, the ad script, and how many requests for ads were refused; with a small picture between YTSHOT lines.
set -u
warn() { echo "::warning::youtube: $*"; adb logcat -d | grep -iE 'WaiYT|AndroidRuntime' | tail -20; exit 0; }
adb install -r app-debug.apk > /dev/null || warn "the test build did not install"
adb logcat -c
adb shell am start -W -n app.mohanndj.alwaei/.MainActivity > /dev/null
PID=""
for i in $(seq 1 30); do
  sleep 2
  PID=$(adb shell pidof app.mohanndj.alwaei | tr -d '\r')
  [ -n "$PID" ] && break
done
[ -n "$PID" ] || warn "the app did not start"
sleep 20
adb forward tcp:9223 "localabstract:webview_devtools_remote_$PID" > /dev/null || warn "no debugging address"
WS=""
for i in $(seq 1 10); do
  WS=$(curl -s -m 5 localhost:9223/json | python3 -c "import sys,json; print([p for p in json.load(sys.stdin) if 'mohanndj' in p.get('url','')][0]['webSocketDebuggerUrl'])" 2>/dev/null)
  [ -n "$WS" ] && break
  sleep 3
done
[ -n "$WS" ] || warn "the page's debugging is not open"
echo "the page: openYoutube is $(python3 android/ci-cdp.py "$WS" 'typeof WaiNative.openYoutube')"
python3 android/ci-cdp.py "$WS" 'WaiNative.openYoutube(), 1' > /dev/null
sleep 45
adb shell dumpsys activity activities | grep -iE 'topResumedActivity' | head -2
LOG=$(adb logcat -d -s WaiYT:* | grep 'page ' | tail -3)
echo "$LOG"
echo "$LOG" | grep -q 'youtube' || warn "YouTube's page was not reached"
# (the page's answer is logged as JSON text, its quotes escaped, as ci-smoke.sh reads it)
echo "$LOG" | grep -q 'bridge\\":\\"undefined' || { echo "::error::youtube: the app's bridge is in YouTube's page"; exit 1; }
echo "$LOG" | grep -q 'ad\\":{' || warn "the ad script is not in the page"
adb exec-out screencap -p > yt.png
python3 - <<'PY'
import base64, io
from PIL import Image
im = Image.open("yt.png").convert("RGB")
im.thumbnail((360, 720))
b = io.BytesIO(); im.save(b, "JPEG", quality=60)
print("YTSHOT " + base64.b64encode(b.getvalue()).decode())
PY
# (v153: what draws him in hidden: the first page a search box, no Shorts, no videos suggested)
echo "$LOG" | grep -q 'calm\\":{\\"home\\":true' || warn "the calm script is not in the first page"
echo "$LOG" | grep -q 'box\\":true' || warn "the search box is not seen on the first page"
echo "youtube: checked"
