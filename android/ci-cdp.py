# python3 android/ci-cdp.py <the page's debugging address> <expression>: what the page answers, for the widget's check
# on GitHub's emulator (android/ci-widget.sh)
import json, sys
import websocket

ws = websocket.create_connection(sys.argv[1], suppress_origin=True, timeout=30)
ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {"expression": sys.argv[2], "returnByValue": True, "awaitPromise": True}}))
while True:
    m = json.loads(ws.recv())
    if m.get("id") == 1:
        r = m.get("result", {}).get("result", {})
        print(json.dumps(r["value"] if "value" in r else m, ensure_ascii=False))
        break
