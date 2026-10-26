#!/usr/bin/env bash
# Run by GitHub on the emulator after ci-smoke.sh: the widget «اليوم» checked from end to end. A test build of the app
# (its page can be filled from here) gets some tasks for today; a home screen of one widget (android/widgethost) shows
# it; its circles are pressed; and the page must have marked them done. Each step is written in the log, with the
# widget's text and a small picture of it (base64, between WIDGETSHOT lines).
set -u
fail() { echo "::error::widget: $*"; exit 1; }
adb uninstall app.mohanndj.alwaei > /dev/null 2>&1 || true
adb install -r app-debug.apk || fail "the test build did not install"
adb install -r widgethost.apk || fail "the home screen of the check did not install"
# what the phone says about the app, when a step fails
why() {
  echo "--- the app's processes"; adb shell ps -A | grep -i alwaei
  echo "--- debugging addresses"; adb shell cat /proc/net/unix 2>&1 | grep -io 'devtools[a-z_0-9]*' | sort -u
  echo "--- the app's stops"; adb logcat -d -b crash | tail -40
  echo "--- the phone's log about it"; adb logcat -d | grep -iE 'alwaei|AndroidRuntime|WaiApp|chromium' | tail -60
}
adb logcat -c
adb shell am start -W -n app.mohanndj.alwaei/.MainActivity
PID=""
for i in $(seq 1 30); do
  sleep 2
  PID=$(adb shell pidof app.mohanndj.alwaei | tr -d '\r')
  [ -n "$PID" ] || PID=$(adb shell ps -A -o PID,NAME | tr -d '\r' | awk '$2 == "app.mohanndj.alwaei" { print $1 }')
  [ -n "$PID" ] && break
done
echo "app pid: $PID"
[ -n "$PID" ] || { why; fail "the test build is not running"; }
sleep 20
# the page's debugging address (a test build's WebView opens it under its process's number; the list of such
# addresses, /proc/net/unix, is closed to the emulator's shell on newer Android, so it is tried directly)
adb forward tcp:9222 "localabstract:webview_devtools_remote_$PID" || fail "no address for the page's debugging"
WS=""
for i in $(seq 1 10); do
  WS=$(curl -s -m 5 localhost:9222/json | python3 -c "import sys,json; print([p for p in json.load(sys.stdin) if 'mohanndj' in p.get('url','')][0]['webSocketDebuggerUrl'])" 2>/dev/null)
  [ -n "$WS" ] && break
  sleep 3
done
[ -n "$WS" ] || { curl -s -m 5 localhost:9222/json | head -c 400; why; fail "the page's debugging is not open"; }
page() { python3 android/ci-cdp.py "$WS" "$1"; }
# the site's newest version (GitHub publishes the site a minute or two after the push that built this app)
WANT=$(grep -o 'APP_VERSION = [0-9]*' app.js | grep -o '[0-9]*$')
for i in $(seq 1 12); do
  V=$(page 'APP_VERSION')
  echo "page version: $V (wanted $WANT)"
  [ "$V" -ge "$WANT" ] 2>/dev/null && break
  page "(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); setTimeout(() => location.reload(), 100); return 1; })()" > /dev/null
  sleep 25
done
[ "$(page 'APP_VERSION')" -ge "$WANT" ] 2>/dev/null || fail "the site's version $WANT is not published yet"
# some tasks for today (one late, a goal counted, one only for tomorrow)
page "(() => { const d = today(); S.settings.remShown = Date.now() + 1e9;
  S.tasks.push(normalize({ id: 'w1', title: 'اجتماع الفريق', due: d, time: '09:30' }), normalize({ id: 'w2', title: 'مراجعة التقرير', due: addDays(d, -2) }),
    normalize({ id: 'w3', kind: 'goal', title: 'شرب الماء', repeat: { days: [0, 1, 2, 3, 4, 5, 6], start: d, until: null }, target: 8, unit: 'أكواب' }),
    normalize({ id: 'w4', kind: 'goal', title: 'المشي', repeat: { days: [0, 1, 2, 3, 4, 5, 6], start: d, until: null }, time: '17:00' }),
    normalize({ id: 'w5', title: 'شراء هدية', due: d }), normalize({ id: 'w6', title: 'لغد فقط', due: addDays(d, 1) }));
  save(); return S.tasks.length; })()"
sleep 4
adb shell appwidget grantbind --package app.mohanndj.alwaei.host --user 0
adb shell am start -W -n app.mohanndj.alwaei.host/.HostActivity
sleep 6
adb logcat -d -s WaiHost:* | tail -3
# the widget's text (every text and label on the screen), and its picture
look() {
  adb shell uiautomator dump /sdcard/w.xml > /dev/null
  adb pull /sdcard/w.xml "$1.xml" > /dev/null
  adb exec-out screencap -p > "$1.png"
  python3 - "$1" <<'PY'
import sys, re, base64, io
from PIL import Image
n = sys.argv[1]
x = open(n + ".xml", encoding="utf-8").read()
print(n + " text: " + " ¦ ".join(t for t in re.findall(r'(?:text|content-desc)="([^"]+)"', x) if t.strip()))
im = Image.open(n + ".png").convert("RGB")
w, h = im.size
im = im.crop((0, int(h * 0.22), w, int(h * 0.78)))
im.thumbnail((540, 540))
b = io.BytesIO(); im.save(b, "JPEG", quality=62)
print("WIDGETSHOT " + n + " " + base64.b64encode(b.getvalue()).decode())
PY
}
press() { # the circle labelled «أتممت: <title>»
  B=$(python3 -c "
import re,sys
x=open('$1.xml',encoding='utf-8').read()
m=re.search(r'content-desc=\"أتممت: $2\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"', x) or re.search(r'bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"[^>]*content-desc=\"أتممت: $2\"', x)
print('' if not m else '%d %d' % ((int(m.group(1))+int(m.group(3)))//2, (int(m.group(2))+int(m.group(4)))//2))")
  [ -n "$B" ] || fail "no circle for «$2»"
  adb shell input tap $B
}
look w1
grep -q 'اجتماع الفريق' w1.xml && grep -q 'مراجعة التقرير' w1.xml && grep -q 'شرب الماء' w1.xml && grep -q 'المشي' w1.xml && grep -q 'شراء هدية' w1.xml || fail "today's tasks are not all shown"
grep -q 'لغد فقط' w1.xml && fail "tomorrow's task is shown today"
grep -q 'متأخرة' w1.xml || fail "the late task is not marked late"
press w1 'شراء هدية'
sleep 5
look w2
grep -q 'شراء هدية' w2.xml && fail "the task ticked is still shown"
DONE=$(page "getTask('w5').done")
echo "page: «شراء هدية» done: $DONE"
[ "$DONE" = "true" ] || fail "the page did not mark the task done"
press w2 'شرب الماء'
sleep 5
look w3
CNT=$(page "countOn(getTask('w3'), today())")
echo "page: «شرب الماء» count: $CNT"
[ "$CNT" = "1" ] || fail "the page did not count the goal"
grep -q 'شرب الماء' w3.xml || fail "the goal counted left the widget before it was full"
# the new day (best effort: the emulator's date moved to tomorrow, then the widget's midnight call)
if adb root > /dev/null 2>&1; then
  sleep 3
  T=$(adb shell date -d @$(( $(adb shell date +%s | tr -d '\r') + 86400 )) +%m%d%H%M%Y.%S 2>/dev/null | tr -d '\r')
  adb shell date "$T" > /dev/null 2>&1 && adb shell am broadcast -n app.mohanndj.alwaei/.TodayWidget -a app.mohanndj.alwaei.WIDGET_DAY > /dev/null && sleep 4 && look w4 \
    && { grep -q 'لغد فقط' w4.xml && echo "the new day: tomorrow's list shown" || echo "::warning::the new day: tomorrow's list not shown"; }
fi
echo "widget check passed"
