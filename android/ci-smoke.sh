#!/usr/bin/env bash
# Run by GitHub on an Android emulator after each build: installs the app, opens it, and checks in the phone's log that
# the app's page opened (its version and its first page) with no error from the page.
set -u
adb install -r alwaei.apk
# the emulator's network may come up after it has booted: wait until the site's name resolves (an app opened before
# that showed «تحتاج إلى الإنترنت في أول فتح», as it should, and the check failed)
for i in $(seq 1 60); do
  out=$(adb shell ping -c 1 -W 1 mohanndj.github.io 2>&1 || true)
  case "$out" in *nknown*host*|*"bad address"*|"") sleep 2 ;; *) echo "network ready after $i tries"; break ;; esac
done
adb logcat -c
adb shell am start -W -n app.mohanndj.alwaei/.MainActivity
sleep 45
adb logcat -d -s WaiApp:* > smoke.log || true
adb exec-out screencap -p > smoke.png || true
cat smoke.log
if ! grep -q 'page "{\\"v\\":[0-9]' smoke.log; then echo "::error::the app's page did not open"; exit 1; fi
if grep -q 'console ERROR' smoke.log; then echo "::error::the page logged an error"; exit 1; fi
echo "smoke test passed"
