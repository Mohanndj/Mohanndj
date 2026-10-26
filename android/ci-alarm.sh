#!/usr/bin/env bash
# Run by GitHub on the emulator after ci-widget.sh (v121): a reminder's alarm stays on the screen until answered.
# With the phone in use, its notification must still be at the top of the screen half a minute later; with the screen
# off, its whole screen (AlarmActivity) comes up over the lock with its text, «رجوع» does not close it, and its «تمت»
# ticks the reminder in the page. Pictures of both are written in the log (base64, between ALARMSHOT lines).
set -u
why() {
  echo "--- the screen's activity"; adb shell dumpsys activity activities | grep -iE 'mResumedActivity|topResumedActivity' | head -3
  echo "--- the app's stops"; adb logcat -d -b crash | tail -40
  echo "--- the phone's log about it"; adb logcat -d | grep -iE 'alwaei|AndroidRuntime|WaiApp|NotificationService|FullScreen' | tail -60
}
fail() { echo "::error::alarm: $*"; why; exit 1; }
look() {
  adb shell uiautomator dump /sdcard/a.xml > /dev/null 2>&1
  adb pull /sdcard/a.xml "$1.xml" > /dev/null 2>&1 || : > "$1.xml"
  adb exec-out screencap -p > "$1.png"
  python3 - "$1" <<'PY'
import sys, re, base64, io
from PIL import Image
n = sys.argv[1]
x = open(n + ".xml", encoding="utf-8").read()
print(n + " text: " + " ¦ ".join(t for t in re.findall(r'(?:text|content-desc)="([^"]+)"', x) if t.strip()))
im = Image.open(n + ".png").convert("RGB")
im.thumbnail((360, 720))
b = io.BytesIO(); im.save(b, "JPEG", quality=60)
print("ALARMSHOT " + n + " " + base64.b64encode(b.getvalue()).decode())
PY
}
top() { adb shell dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity' | head -1; }
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard > /dev/null 2>&1 || true
adb logcat -c
adb shell am start -W -n app.mohanndj.alwaei/.MainActivity > /dev/null
PID=""
for i in $(seq 1 30); do
  sleep 2
  PID=$(adb shell pidof app.mohanndj.alwaei | tr -d '\r')
  [ -n "$PID" ] && break
done
[ -n "$PID" ] || fail "the test build is not running"
sleep 8
adb forward tcp:9223 "localabstract:webview_devtools_remote_$PID" > /dev/null || fail "no address for the page's debugging"
WS=""
for i in $(seq 1 10); do
  WS=$(curl -s -m 5 localhost:9223/json | python3 -c "import sys,json; print([p for p in json.load(sys.stdin) if 'mohanndj' in p.get('url','')][0]['webSocketDebuggerUrl'])" 2>/dev/null)
  [ -n "$WS" ] && break
  sleep 3
done
[ -n "$WS" ] || fail "the page's debugging is not open"
page() { python3 android/ci-cdp.py "$WS" "$1"; }
echo "full-screen permission (appops): $(adb shell appops get app.mohanndj.alwaei USE_FULL_SCREEN_INTENT | tr -d '\r')"
FSI=$(page "WaiNative.fsiState()")
echo "the page reads: fsiState = $FSI"
if [ "$FSI" != '"ok"' ]; then
  echo "::warning::the phone did not give the app the full screen by itself: allowed here to go on"
  adb shell appops set app.mohanndj.alwaei USE_FULL_SCREEN_INTENT allow
fi
# a reminder ringing at the next whole minute (at least twenty seconds from now); the seconds until then
remind() {
  page "(() => { S.settings.remShown = Date.now() + 1e9; const n = new Date(Date.now() + 80000); const tm = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'), d = iso(n);
    S.reminders.push(normalizeReminder({ id: '$1', text: '$2', due: d, times: [tm] })); save();
    return Math.round((parse(d).getTime() + minutesOf(tm) * 60000 - Date.now()) / 1000); })()"
}

# 1. the phone in use: its notification stays at the top of the screen
S1=$(remind ra1 'تذكير تجريبي يبقى أعلى الشاشة: أعد الكتاب لصاحبه')
echo "first reminder rings in $S1 s"
sleep 3
adb shell input keyevent KEYCODE_HOME
sleep $(( S1 + 30 ))
NOTE=$(adb shell dumpsys notification --noredact | tr -d '\r' | grep -A80 'pkg=app.mohanndj.alwaei' | grep -iE 'fullscreenIntent|android.text=|android.title=' | head -6)
echo "$NOTE"
echo "$NOTE" | grep -q 'أعد الكتاب' || fail "the reminder's notification is not on the phone"
echo "$NOTE" | grep -iq 'fullscreenIntent=PendingIntent' || fail "the reminder's notification has no full screen"
echo "--- heads-up state"; adb shell dumpsys activity service com.android.systemui 2>/dev/null | tr -d '\r' | grep -iE 'headsup|HeadsUpEntry|mHasPinnedNotification' | head -12
look a1
# answered in the page: the notification leaves
page "(() => { alarmAction('done', 'rem:ra1', 'rem:ra1|' + today() + '|0'); return S.reminders.find((x) => x.id === 'ra1').done; })()"
sleep 3

# 2. the screen off: its whole screen over the lock
S2=$(remind ra2 'اتصل بأبي بعد صلاة العصر وأخبره بموعد السفر')
echo "second reminder rings in $S2 s"
sleep 3
adb shell input keyevent KEYCODE_SLEEP
sleep $(( S2 + 10 ))
T=$(top)
echo "on top: $T"
echo "$T" | grep -q 'AlarmActivity' || { look a2x; fail "the reminder's screen did not come up with the screen off"; }
look a2
grep -q 'اتصل بأبي بعد صلاة العصر' a2.xml || fail "the reminder's screen does not show its text"
grep -q 'غفوة' a2.xml && grep -q 'إغلاق' a2.xml || fail "the reminder's screen lacks its buttons"
adb shell input keyevent KEYCODE_BACK
sleep 2
top | grep -q 'AlarmActivity' || fail "«رجوع» closed the reminder's screen"
B=$(python3 -c "
import re
x=open('a2.xml',encoding='utf-8').read()
m=re.search(r'text=\"تمت\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"', x)
print('' if not m else '%d %d' % ((int(m.group(1))+int(m.group(3)))//2, (int(m.group(2))+int(m.group(4)))//2))")
[ -n "$B" ] || fail "no «تمت» on the reminder's screen"
adb shell input tap $B
sleep 5
DONE=$(page "S.reminders.find((x) => x.id === 'ra2').done")
echo "page: the second reminder done: $DONE"
[ "$DONE" = "true" ] || fail "«تمت» on the reminder's screen did not tick it"
top | grep -q 'AlarmActivity' && fail "the reminder's screen stayed after «تمت»"
adb shell dumpsys notification --noredact | grep -q 'اتصل بأبي بعد صلاة العصر' && echo "::warning::the phone's notification list still names the second reminder (maybe its record of past ones)"
if adb logcat -d -b crash | grep -q 'app.mohanndj.alwaei'; then adb logcat -d -b crash | tail -30; fail "the app crashed"; fi
echo "alarm check passed"
