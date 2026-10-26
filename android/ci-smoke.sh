#!/usr/bin/env bash
# Run by GitHub on an Android emulator after each build: installs the app, opens it, and checks in the phone's log that
# the app's page opened (its version and its first page) with no error from the page.
set -u
adb install -r alwaei.apk
adb logcat -c
adb shell am start -W -n app.mohanndj.alwaei/.MainActivity
sleep 45
adb logcat -d -s WaiApp:* > smoke.log || true
adb exec-out screencap -p > smoke.png || true
cat smoke.log
if ! grep -q 'page "{\\"v\\":[0-9]' smoke.log; then echo "::error::the app's page did not open"; exit 1; fi
if grep -q 'console ERROR' smoke.log; then echo "::error::the page logged an error"; exit 1; fi
echo "smoke test passed"
