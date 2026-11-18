#!/usr/bin/env bash
# Run by GitHub on the emulator after ci-smoke.sh: the widget «اليوم» checked from end to end. A test build of the app
# (its page can be filled from here) gets some tasks for today; a home screen of one widget (android/widgethost) shows
# it; its circles are pressed; and the page must have marked them done. Each step is written in the log, with the
# widget's text and a small picture of it (base64, between WIDGETSHOT lines).
set -u
# what the phone says about the app, when a step fails
why() {
  echo "--- the screen's activity"; adb shell dumpsys activity activities | grep -iE 'mResumedActivity|topResumedActivity' | head -3
  echo "--- the app's processes"; adb shell ps -A | grep -i alwaei
  echo "--- debugging addresses"; adb shell cat /proc/net/unix 2>&1 | grep -io 'devtools[a-z_0-9]*' | sort -u
  echo "--- the app's stops"; adb logcat -d -b crash | tail -40
  echo "--- the phone's log about it"; adb logcat -d | grep -iE 'alwaei|AndroidRuntime|WaiApp|WaiHost|chromium' | tail -60
}
fail() { echo "::error::widget: $*"; why; exit 1; }
adb uninstall app.mohanndj.alwaei > /dev/null 2>&1 || true
adb install -r app-debug.apk || fail "the test build did not install"
adb install -r widgethost.apk || fail "the home screen of the check did not install"
adb logcat -c
# the app opened and its page reached (tried three times: the emulator's Google services may die soon after it
# boots, and the system then stops the apps that use them, this one among them)
attach() {
  adb shell am start -W -n app.mohanndj.alwaei/.MainActivity > /dev/null
  PID=""
  for i in $(seq 1 30); do
    sleep 2
    PID=$(adb shell pidof app.mohanndj.alwaei | tr -d '\r')
    [ -n "$PID" ] || PID=$(adb shell ps -A -o PID,NAME | tr -d '\r' | awk '$2 == "app.mohanndj.alwaei" { print $1 }')
    [ -n "$PID" ] && break
  done
  echo "app pid: $PID"
  [ -n "$PID" ] || return 1
  sleep 20
  # the page's debugging address (a test build's WebView opens it under its process's number; the list of such
  # addresses, /proc/net/unix, is closed to the emulator's shell on newer Android, so it is tried directly)
  adb forward tcp:9222 "localabstract:webview_devtools_remote_$PID" > /dev/null || return 1
  WS=""
  for i in $(seq 1 10); do
    WS=$(curl -s -m 5 localhost:9222/json | python3 -c "import sys,json; print([p for p in json.load(sys.stdin) if 'mohanndj' in p.get('url','')][0]['webSocketDebuggerUrl'])" 2>/dev/null)
    [ -n "$WS" ] && return 0
    sleep 3
  done
  return 1
}
WS=""
for t in 1 2 3; do
  attach && break
  echo "::warning::the app or its page was not reached (try $t): started again"
  adb forward --remove tcp:9222 > /dev/null 2>&1
  sleep 5
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
# some tasks for today (one whose day passed, a goal counted, one only for tomorrow)
page "(() => { const d = today(); S.settings.remShown = Date.now() + 1e9;
  S.tasks.push(normalize({ id: 'w1', title: 'اجتماع الفريق', due: d, time: '09:30' }), normalize({ id: 'w2', title: 'مراجعة التقرير', due: addDays(d, -2) }),
    normalize({ id: 'w3', kind: 'goal', title: 'شرب الماء', repeat: { days: [0, 1, 2, 3, 4, 5, 6], start: d, until: null }, target: 8, unit: 'أكواب' }),
    normalize({ id: 'w4', kind: 'goal', title: 'المشي', repeat: { days: [0, 1, 2, 3, 4, 5, 6], start: d, until: null }, time: '17:00' }),
    normalize({ id: 'w5', title: 'شراء هدية', due: d }), normalize({ id: 'w6', title: 'لغد فقط', due: addDays(d, 1) }));
  save(); return S.tasks.length; })()"
sleep 4
adb shell appwidget grantbind --package app.mohanndj.alwaei.host --user 0
adb shell am start -W -n app.mohanndj.alwaei.host/.HostActivity
sleep 4
# drawn again from what the page sent (as at midnight)
adb shell am broadcast -n app.mohanndj.alwaei/.TodayWidget -a app.mohanndj.alwaei.WIDGET_DAY > /dev/null
sleep 3
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
grep -q 'اجتماع الفريق' w1.xml && grep -q 'شرب الماء' w1.xml && grep -q 'المشي' w1.xml && grep -q 'شراء هدية' w1.xml || fail "today's tasks are not all shown"
grep -q 'لغد فقط' w1.xml && fail "tomorrow's task is shown today"
# (v146, the owner: what passed its day is not in «اليوم» nor in this widget, and nothing is marked «متأخرة»)
grep -q 'مراجعة التقرير' w1.xml && fail "a task whose day passed is shown"
grep -q 'متأخرة' w1.xml && fail "a task is marked late"
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
# v176: the widget «فوائد الكتب»: some benefits of two books (one not in «الكتب»), the widget placed, «اختر كتاباً»
# pressed, a book chosen: its benefits shown in page order, by title, page and text, and the other book's not
# («adb root» above restarts adb, and with it the forward to the page's debugging address: made again)
adb forward tcp:9222 "localabstract:webview_devtools_remote_$PID" > /dev/null || fail "the page's debugging is not open again"
# (the widget placed first: a home screen of the check sends it no APPWIDGET_UPDATE, so it is drawn when the page sends
# its benefits)
adb shell am start -S -W -n app.mohanndj.alwaei.host/.HostActivity --es provider BenWidget > /dev/null
sleep 5
page "(() => { S.books.push(normalizeBook({ id: 'bk1', title: 'الموافقات', status: 'reading' }));
  S.benefits.push(normalizeBenefit({ id: 'f1', bookId: 'bk1', book: 'الموافقات', page: 40, title: 'مقاصد الشريعة', text: 'نص الفائدة الثانية' }),
    normalizeBenefit({ id: 'f2', bookId: 'bk1', book: 'الموافقات', page: 12, title: 'العادات والعبادات', text: 'نص الفائدة الأولى' }),
    normalizeBenefit({ id: 'f3', book: 'كتاب آخر', page: 5, title: 'فائدة من غيره', text: 'لا تظهر' }));
  save(); return S.benefits.length; })()"
sleep 4
adb logcat -d -s WaiHost:* | tail -2
look b1
grep -q 'اختر كتاباً' b1.xml || fail "bens: no «اختر كتاباً»"
tapdesc() { # a text on the screen pressed
  B=$(python3 -c "
import re,sys
x=open('$1.xml',encoding='utf-8').read()
m=re.search(r'text=\"$2\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"', x)
print('' if not m else '%d %d' % ((int(m.group(1))+int(m.group(3)))//2, (int(m.group(2))+int(m.group(4)))//2))")
  [ -n "$B" ] || fail "bens: no «$2» to press"
  adb shell input tap $B
}
tapdesc b1 'اختر كتاباً'
sleep 3
look b2
grep -q 'الموافقات' b2.xml && grep -q 'كتاب آخر' b2.xml || fail "bens: the books are not in «اختر كتاباً»"
tapdesc b2 'الموافقات'
sleep 4
look b3
grep -q 'مقاصد الشريعة' b3.xml && grep -q 'العادات والعبادات' b3.xml && grep -q 'نص الفائدة الأولى' b3.xml || fail "bens: the chosen book's benefits are not shown"
grep -q 'فائدة من غيره' b3.xml && fail "bens: another book's benefit is shown"
python3 -c "
x=open('b3.xml',encoding='utf-8').read()
a,b=x.find('العادات والعبادات'),x.find('مقاصد الشريعة')
exit(0 if 0<=a<b else 1)" || fail "bens: not in page order"
# a benefit added in the app reaches the widget
page "(() => { S.benefits.push(normalizeBenefit({ id: 'f4', bookId: 'bk1', book: 'الموافقات', page: 20, title: 'فائدة جديدة', text: 'وصلت' })); save(); return 1; })()"
sleep 5
look b4
grep -q 'فائدة جديدة' b4.xml || fail "bens: a new benefit did not reach the widget"
# v177: three at a time (was five); a ✓ takes one off and the next comes; all off: «مررت على كل فوائده» and «من جديد» brings them back
page "(() => { for (const [i, p] of [[5, 50], [6, 60], [7, 70]]) S.benefits.push(normalizeBenefit({ id: 'f' + i, bookId: 'bk1', book: 'الموافقات', page: p, title: 'فائدة رقم ' + i, text: 'نص ' + i })); save(); return 1; })()"
sleep 5
look b5
# (the rows below the widget's height are not in the screen's text: what came is counted by the ✓ pressed below)
grep -q 'فائدة رقم 5' b5.xml && fail "bens: more than three shown"
grep -q 'فائدة رقم ٥' b5.xml && fail "bens: more than three shown"
okdesc() { # the ✓ labelled «أزل: <title>»
  B=$(python3 -c "
import re,sys
x=open('$1.xml',encoding='utf-8').read()
m=re.search(r'content-desc=\"أزل: $2\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"', x)
print('' if not m else '%d %d' % ((int(m.group(1))+int(m.group(3)))//2, (int(m.group(2))+int(m.group(4)))//2))")
  [ -n "$B" ] || fail "bens: no ✓ for «$2»"
  adb shell input tap $B
}
okdesc b5 'العادات والعبادات'
sleep 4
look b6
grep -q 'العادات والعبادات' b6.xml && fail "bens: the benefit taken off is still shown"
[ "$(page "S.benefits.some((f) => f.id === 'f2')")" = "true" ] || fail "bens: the benefit was deleted from the app"
# all taken off, one by one (the first row's ✓ each time): five more (the sixth came when the first went)
K=0
for i in 1 2 3 4 5 6 7; do
  look bx
  T=$(python3 -c "
import re
x=open('bx.xml',encoding='utf-8').read()
m=re.search(r'content-desc=\"أزل: ([^\"]+)\"', x)
print(m.group(1) if m else '')")
  [ -n "$T" ] || break
  okdesc bx "$T"
  K=$((K + 1))
  sleep 3
done
echo "bens: taken off after the first: $K"
[ "$K" = "5" ] || fail "bens: $K taken off after the first, not five"
look b7
grep -q 'مررت على كل فوائده' b7.xml && grep -q 'من جديد' b7.xml || fail "bens: no «مررت على كل فوائده» and «من جديد» when all are off"
tapdesc b7 'من جديد'
sleep 4
look b8
grep -q 'العادات والعبادات' b8.xml || fail "bens: «من جديد» did not bring them back"
# v178: a benefit's text pressed opens the app on that benefit's own window
tapdesc b8 'العادات والعبادات'
sleep 8
attach || fail "bens: the page was not reached after a benefit was pressed"
for i in 1 2 3 4 5; do
O=$(page "(() => { return (typeof ldraft !== 'undefined' && ldraft ? ldraft.kind + ':' + ldraft.id : '') + '|' + ui.tab + '|' + ((document.getElementById('lTitle') || {}).value || ''); })()")
case "$O" in benefit:f2*) break ;; esac
sleep 3
done
echo "bens: pressed a benefit: $O"
case "$O" in benefit:f2\|benefits\|العادات\ والعبادات) ;; *) fail "bens: pressing a benefit did not open it in the app ($O)" ;; esac
echo "bens widget check passed"
echo "widget check passed"
