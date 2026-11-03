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
# (v160: each video's place and the list «للاستماع» in the page; the app's page hidden while YouTube is whole)
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
note() { echo "::warning::youtube: $*"; }
# (v161, his answers: no small window, the video playing on in the background with a floating icon; leaving the app it
# plays on with a notification; the screen turned off stops it; a long press on the icon stops it)
vid() { python3 android/ci-cdp.py "$YT" "(function(){var v=document.querySelector('video');return {t:v&&Math.round(v.currentTime*10)/10,paused:v&&v.paused,seen:document.visibilityState}})()"; }
moving() { python3 - "$1" "$2" <<'PY'
import json, sys
try:
    a, b = json.loads(sys.argv[1]), json.loads(sys.argv[2])
    print("yes" if a and b and not b["paused"] and b["t"] > a["t"] + 2 else "no")
except Exception:
    print("no")
PY
}
tapdesc() { adb shell uiautomator dump /sdcard/y.xml > /dev/null 2>&1; adb pull /sdcard/y.xml y.xml > /dev/null 2>&1 || : > y.xml
  python3 - "$1" <<'PY'
import re, sys
x = open("y.xml", encoding="utf-8").read()
m = re.search(r'content-desc="' + re.escape(sys.argv[1]) + r'"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', x)
print("%d %d" % ((int(m[1]) + int(m[3])) // 2, (int(m[2]) + int(m[4])) // 2) if m else "")
PY
}
ICONDESC="يوتيوب يعمل: اضغط لتفتحه، واضغط مطوّلاً لتوقفه"
A=$(vid); echo "playing whole: $A"
adb shell input keyevent KEYCODE_BACK; sleep 3
adb logcat -d -s WaiYT:* | grep -E 'state|playing' | tail -3
sleep 8; B=$(vid); echo "behind the icon: $B"
echo "the app's page with YouTube behind the icon: $(python3 android/ci-cdp.py "$WS" 'document.visibilityState')"
echo "the keep script: $(python3 android/ci-cdp.py "$YT" 'JSON.stringify(window.__waiKeep)')"
[ "$(moving "$A" "$B")" = yes ] && echo "behind the icon: plays on" || note "behind the icon the video did not play on"
shot ICONSHOT
I=$(tapdesc "$ICONDESC"); echo "the icon at: $I"
[ -n "$I" ] || warn "no floating icon"
adb shell input swipe $I $((${I% *} + 60)) $((${I#* } - 200)) 400; sleep 2
I=$(tapdesc "$ICONDESC"); echo "the icon moved to: $I"
adb shell input tap $I; sleep 3
adb logcat -d -s WaiYT:* | grep -E 'state' | tail -1 | grep -q 'state 1' && echo "a tap on the icon: YouTube whole again" || note "a tap on the icon did not show YouTube"
adb shell input keyevent KEYCODE_BACK; sleep 3
adb logcat -d -s WaiYT:* | grep -E 'state' | tail -1 | grep -q 'state 3' || note "back did not hide YouTube behind the icon again"
# (the app left: it plays on, with its notification)
C=$(vid); adb shell input keyevent KEYCODE_HOME; sleep 15; D=$(vid)
echo "the app left: $C then $D"
adb logcat -d -s WaiYT:* | grep -E 'service' | tail -2
adb shell dumpsys notification --noredact 2>/dev/null | grep -E 'id=7341|يوتيوب يعمل' | head -3
[ "$(moving "$C" "$D")" = yes ] && echo "the app left: plays on" || note "the app left, the video did not play on"
adb logcat -d -s WaiYT:* | grep -q 'service on' || note "no notification for the video playing on"
shot HOMESHOT
# (the screen turned off: it stops)
adb shell input keyevent KEYCODE_SLEEP; sleep 6
E=$(vid); echo "the screen off: $E"
adb logcat -d -s WaiYT:* | grep -E 'screen off' | tail -1
echo "$E" | grep -q '"paused": true' && echo "the screen off: stopped" || note "the screen off, the video did not stop"
adb shell input keyevent KEYCODE_WAKEUP; sleep 2; adb shell wm dismiss-keyguard; sleep 2
adb shell am start -n app.mohanndj.alwaei/.MainActivity > /dev/null; sleep 4
echo "its place kept: $(python3 android/ci-cdp.py "$YT" "localStorage.getItem('wai-pos')")"
# (a long press on the icon: stopped and closed)
I=$(tapdesc "$ICONDESC"); echo "the icon at: $I"
[ -n "$I" ] && { adb shell input swipe $I $I 1500; sleep 3; }
adb logcat -d -s WaiYT:* | grep -q 'closed' && echo "a long press on the icon: closed" || note "a long press on the icon did not close YouTube"
echo "youtube: checked"
