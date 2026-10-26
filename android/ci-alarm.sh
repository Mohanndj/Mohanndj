#!/usr/bin/env bash
# Run by GitHub on the emulator after ci-widget.sh. v122: the pinned notification stays through «Clear all» and a finger,
# and goes when its setting is turned off. v121/v124: a reminder's alarm stays on the screen until answered, a window
# over whatever is open when the app may show itself over other apps.
# With the phone in use, its notification must still be at the top of the screen half a minute later; with the screen
# off, its whole screen (AlarmActivity) comes up over the lock with its text, «رجوع» does not close it, and its «قرأت النص»
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
# the app opened and its page reached (tried three times, as in ci-widget.sh)
attach() {
  adb shell am start -W -n app.mohanndj.alwaei/.MainActivity > /dev/null
  PID=""
  for i in $(seq 1 30); do
    sleep 2
    PID=$(adb shell pidof app.mohanndj.alwaei | tr -d '\r')
    [ -n "$PID" ] && break
  done
  echo "app pid: $PID"
  [ -n "$PID" ] || return 1
  sleep 8
  adb forward tcp:9223 "localabstract:webview_devtools_remote_$PID" > /dev/null || return 1
  WS=""
  for i in $(seq 1 10); do
    WS=$(curl -s -m 5 localhost:9223/json | python3 -c "import sys,json; print([p for p in json.load(sys.stdin) if 'mohanndj' in p.get('url','')][0]['webSocketDebuggerUrl'])" 2>/dev/null)
    [ -n "$WS" ] && return 0
    sleep 3
  done
  return 1
}
WS=""
for t in 1 2 3; do
  attach && break
  echo "::warning::the app or its page was not reached (try $t): started again"
  adb forward --remove tcp:9223 > /dev/null 2>&1
  sleep 5
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
# the app's notifications allowed (the test build is installed afresh, so it asks nobody)
adb shell pm grant app.mohanndj.alwaei android.permission.POST_NOTIFICATIONS
# 0. v122: the pinned notification: «Clear all» and a finger leave it (Java's "pin".hashCode() is its number)
# a notification shown now (its number in Java's hashCode): from the phone's list of them, or its whole record
shown() {
  L=$(adb shell cmd notification list 2>/dev/null | tr -d '\r')
  if echo "$L" | grep -qE '^[0-9]+\|'; then echo "$L" | grep -q "|app.mohanndj.alwaei|$1|"
  else adb shell dumpsys notification | tr -d '\r' | awk '/Notification List:/ { on = 1; next } on && /^  [A-Za-z][^:]*:/ { on = 0 } on' | grep -q "app.mohanndj.alwaei|$1|"; fi
}
echo "the phone's list of notifications: $(adb shell cmd notification list 2>/dev/null | tr -d '\r' | head -3 | tr '\n' ' ')"
pinon() { shown 110997; }
page "(() => { S.settings.pin = true; save(); pinNotify(true); return Notification.permission; })()"
sleep 4
pinon || fail "the pinned notification is not shown"
# one more that «Clear all» takes (with the pinned one alone, the shade has no «Clear all»)
page "(() => { new Notification('تجربة', { body: 'إشعار عادي يمسحه «مسح الكل»', tag: 't1' }); return 1; })()"
sleep 2
adb shell dumpsys notification --noredact | tr -d '\r' | grep -E 'id=110997|flags=' | grep -A1 'id=110997' | head -2
adb shell cmd statusbar expand-notifications
sleep 3
look p1
B=$(python3 -c "
import re
x=open('p1.xml',encoding='utf-8').read()
m=re.search(r'(?:text|content-desc)=\"(?:Clear all|Clear all notifications)\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"', x)
print('' if not m else '%d %d' % ((int(m.group(1))+int(m.group(3)))//2, (int(m.group(2))+int(m.group(4)))//2))")
if [ -n "$B" ]; then
  adb shell input tap $B
  sleep 3
  pinon || fail "«Clear all» removed the pinned notification"
  shown 3645 && echo "::warning::«Clear all» left the ordinary notification too" || echo "«Clear all»: the ordinary notification went, the pinned one stayed"
else
  echo "::warning::no «Clear all» on the emulator's shade"
fi
adb shell cmd statusbar expand-notifications
sleep 3
look p2
P=$(python3 -c "
import re
x=open('p2.xml',encoding='utf-8').read()
m=re.search(r'text=\"[^\"]*باقٍ[^\"]*\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"', x)
print('' if not m else '%d %d %d' % (int(m.group(1)), int(m.group(3)), (int(m.group(2))+int(m.group(4)))//2))")
[ -n "$P" ] || fail "the pinned notification is not on the shade"
set -- $P
W=$(adb shell wm size | tr -d '\r' | grep -o '[0-9]*x[0-9]*' | tail -1 | cut -dx -f1)
adb shell input swipe $(( W / 5 )) $3 $(( W - 5 )) $3 250
sleep 4
look p3
pinon || fail "a finger removed the pinned notification"
grep -q 'باقٍ' p3.xml && echo "a finger: the pinned notification is back" || echo "::warning::the pinned notification is kept but not seen on the shade"
adb shell cmd statusbar collapse
sleep 2
# turned off in the settings: it goes
page "(() => { S.settings.pin = false; save(); pinOff(); return 1; })()"
sleep 3
pinon && fail "the pinned notification stayed after its setting was turned off"
echo "pinned notification check passed"

# a reminder ringing at the next whole minute (at least twenty seconds from now); the seconds until then
remind() {
  page "(() => { S.settings.remShown = Date.now() + 1e9; const n = new Date(Date.now() + 80000); const tm = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'), d = iso(n);
    S.reminders.push(normalizeReminder({ id: '$1', text: '$2', due: d, times: [tm] })); save();
    return Math.round((parse(d).getTime() + minutesOf(tm) * 60000 - Date.now()) / 1000); })()"
}

# 1. the phone in use, the app not allowed over other apps: its notification stays at the top of the screen
echo "over other apps (appops): $(adb shell appops get app.mohanndj.alwaei SYSTEM_ALERT_WINDOW | tr -d '\r')"
adb shell appops set app.mohanndj.alwaei SYSTEM_ALERT_WINDOW deny
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
top | grep -q 'AlarmActivity' && echo "::warning::the window came up though the app may not show itself over other apps"
# answered in the page: the notification leaves
page "(() => { alarmAction('done', 'rem:ra1', 'rem:ra1|' + today() + '|0'); return S.reminders.find((x) => x.id === 'ra1').done; })()"
sleep 3

# 1b. v124: the phone in use, the app allowed over other apps («الظهور فوق التطبيقات الأخرى»): its window comes up
# over whatever is open (here the home screen), and «غفوة» puts it off
adb shell appops set app.mohanndj.alwaei SYSTEM_ALERT_WINDOW allow
OV=$(page "WaiNative.overlayState()")
echo "the page reads: overlayState = $OV"
[ "$OV" = '"ok"' ] || fail "the page does not read the permission given"
S3=$(remind ra3 'خذ الدواء بعد الغداء')
echo "third reminder rings in $S3 s"
sleep 3
adb shell input keyevent KEYCODE_HOME
sleep $(( S3 + 8 ))
T=$(top)
echo "on top: $T"
echo "$T" | grep -q 'AlarmActivity' || { look a3x; fail "the reminder's window did not come up over the home screen"; }
look a3
grep -q 'خذ الدواء بعد الغداء' a3.xml || fail "the reminder's window does not show its text"
B=$(python3 -c "
import re
x=open('a3.xml',encoding='utf-8').read()
m=re.search(r'text=\"غفوة\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"', x)
print('' if not m else '%d %d' % ((int(m.group(1))+int(m.group(3)))//2, (int(m.group(2))+int(m.group(4)))//2))")
[ -n "$B" ] || fail "no «غفوة» on the reminder's window"
adb shell input tap $B
sleep 5
SN=$(page "Object.keys(S.snoozed).some((k) => k.startsWith('rem:ra3'))")
echo "page: the third reminder snoozed: $SN"
[ "$SN" = "true" ] || fail "«غفوة» on the reminder's window did not put it off"
top | grep -q 'AlarmActivity' && fail "the reminder's window stayed after «غفوة»"
page "(() => { const r = S.reminders.find((x) => x.id === 'ra3'); r.done = true; for (const k of Object.keys(S.snoozed)) if (k.startsWith('rem:ra3')) delete S.snoozed[k]; save(); return 1; })()" > /dev/null
sleep 2

# 2. the screen off: its window over the lock
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
grep -q 'قرأت النص' a2.xml && grep -q 'غفوة' a2.xml || fail "the reminder's screen lacks its buttons"
grep -q 'text="إغلاق"' a2.xml && fail "the reminder's screen still has «إغلاق» (v123: «قرأت النص» and «غفوة» only)"
# the screen off again, then the phone opened (as by the fingerprint): the window is there, in front
adb shell input keyevent KEYCODE_SLEEP
sleep 4
adb shell input keyevent KEYCODE_WAKEUP
sleep 1
adb shell wm dismiss-keyguard > /dev/null 2>&1 || adb shell input keyevent 82
sleep 4
T=$(top)
echo "on top after opening the phone: $T"
echo "$T" | grep -q 'AlarmActivity' || { look a2x; fail "the reminder's window was not there when the phone was opened"; }
look a2u
grep -q 'اتصل بأبي بعد صلاة العصر' a2u.xml || fail "the reminder's window lost its text when the phone was opened"
adb shell input keyevent KEYCODE_BACK
sleep 2
top | grep -q 'AlarmActivity' || fail "«رجوع» closed the reminder's screen"
B=$(python3 -c "
import re
x=open('a2u.xml',encoding='utf-8').read()
m=re.search(r'text=\"قرأت النص\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"', x)
print('' if not m else '%d %d' % ((int(m.group(1))+int(m.group(3)))//2, (int(m.group(2))+int(m.group(4)))//2))")
[ -n "$B" ] || fail "no «قرأت النص» on the reminder's screen"
adb shell input tap $B
sleep 5
DONE=$(page "S.reminders.find((x) => x.id === 'ra2').done")
echo "page: the second reminder done: $DONE"
[ "$DONE" = "true" ] || fail "«قرأت النص» on the reminder's screen did not tick it"
top | grep -q 'AlarmActivity' && fail "the reminder's screen stayed after «قرأت النص»"
adb shell dumpsys notification --noredact | grep -q 'اتصل بأبي بعد صلاة العصر' && echo "::warning::the phone's notification list still names the second reminder (maybe its record of past ones)"
if adb logcat -d -b crash | grep -q 'app.mohanndj.alwaei'; then adb logcat -d -b crash | tail -30; fail "the app crashed"; fi
echo "alarm check passed"
