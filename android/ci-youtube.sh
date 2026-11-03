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
# (v160: each video's place and the list «للاستماع» in the page; a video playing goes small over the app's pages on back,
# and into the phone's small window when the app is left; the app's page hidden while YouTube is whole)
echo "$LOG" | grep -q 'keep\\":{' || warn "the keep script is not in the page"
echo "the app's page while YouTube is whole: $(python3 android/ci-cdp.py "$WS" 'document.visibilityState')"
shot() { adb exec-out screencap -p > s.png; python3 - "$1" <<'PY'
import base64, io, sys
from PIL import Image
im = Image.open("s.png").convert("RGB"); im.thumbnail((360, 720))
b = io.BytesIO(); im.save(b, "JPEG", quality=60)
print(sys.argv[1] + " " + base64.b64encode(b.getvalue()).decode())
PY
}
YT=$(curl -s -m 5 localhost:9223/json | python3 -c "import sys,json; print([p for p in json.load(sys.stdin) if 'youtube.com' in p.get('url','')][0]['webSocketDebuggerUrl'])" 2>/dev/null)
[ -n "$YT" ] || warn "YouTube's page has no debugging address"
python3 android/ci-cdp.py "$YT" "location.href='/watch?v=dQw4w9WgXcQ', 1" > /dev/null
sleep 25
# (the phone's own tap on the player starts it, as his finger would)
SIZE=$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1); W=${SIZE%x*}
adb shell input tap $((W / 2)) $((W * 9 / 32 + 150)); sleep 2
python3 android/ci-cdp.py "$YT" "(function(){var b=document.querySelector('.ytp-large-play-button,.ytmVideoPlayerOverlayPlayButton,button[aria-label*=Play]');if(b)b.click();var v=document.querySelector('video');return v?v.play().then(function(){return 'play'},function(e){return 'no '+e}):'no video'})()"
sleep 20
echo "the video: $(python3 android/ci-cdp.py "$YT" "(function(){var v=document.querySelector('video');return v?{t:v.currentTime,paused:v.paused,ad:!!document.querySelector('.ad-showing')}:null})()")"
echo "its place kept: $(python3 android/ci-cdp.py "$YT" "localStorage.getItem('wai-pos')")"
shot VIDEOSHOT
# (does the page's small look alone stop YouTube's video? the page's size unchanged)
echo "the small look alone: $(python3 android/ci-cdp.py "$YT" "new Promise(function(ok){window.__waiMini(true);setTimeout(function(){var v=document.querySelector('video');var r={paused:v.paused,t:v.currentTime};window.__waiMini(false);ok(r)},4000)})")"
adb shell input keyevent KEYCODE_BACK; sleep 4
adb logcat -d -s WaiYT:* | grep -E 'state|pip' | tail -3
echo "small over the app: $(python3 android/ci-cdp.py "$YT" "(function(){var v=document.querySelector('video');return {mini:document.documentElement.classList.contains('wai-mini'),w:innerWidth,h:innerHeight,t:v&&v.currentTime,paused:v&&v.paused}})()")"
echo "the app's page with YouTube small: $(python3 android/ci-cdp.py "$WS" 'document.visibilityState')"
echo "the keep script: $(python3 android/ci-cdp.py "$YT" 'JSON.stringify(window.__waiKeep)')"
adb logcat -d -s WaiYT:* | grep -E 'whole screen' | tail -3
shot MINISHOT
# (if it paused going small, started again here, to see the small window over everything)
python3 android/ci-cdp.py "$YT" "(function(){var v=document.querySelector('video');return v&&v.paused?v.play().then(function(){return 'played again'},function(e){return 'no '+e}):'playing'})()"
sleep 4
adb shell input keyevent KEYCODE_HOME; sleep 6
adb logcat -d -s WaiYT:* | grep -E 'pip' | tail -2
adb shell dumpsys activity activities | grep -iE 'pinned|windowingMode=pinned' | head -3
echo "in the small window: $(python3 android/ci-cdp.py "$YT" "(function(){var v=document.querySelector('video');return {t:v&&v.currentTime,paused:v&&v.paused,w:innerWidth}})()")"
sleep 8
echo "…and later: $(python3 android/ci-cdp.py "$YT" "(function(){var v=document.querySelector('video');return {t:v&&v.currentTime,paused:v&&v.paused}})()")"
echo "the keep script: $(python3 android/ci-cdp.py "$YT" 'JSON.stringify(window.__waiKeep)')"
shot PIPSHOT
adb logcat -d | grep -E 'pip true' -q || warn "the small window over everything did not come"
echo "youtube: checked"
