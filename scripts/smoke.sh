#!/usr/bin/env bash
# curl half of BUILD_PLAN §3.3. Exits non-zero on the first failure. Needs backend on :8000 (and sim for check 1b).
set -euo pipefail
BASE="${SENTINEL_BASE:-http://localhost:8000}"
PY="${PY:-$(dirname "$0")/../backend/.venv/bin/python}"
FAIL=0

jget() { "$PY" -c 'import json,sys; d=json.load(sys.stdin); print(eval("d"+sys.argv[1]))' "$1"; }
check() { # name, condition-exit-code
  if [ "$2" -eq 0 ]; then echo "PASS  $1"; else echo "FAIL  $1"; exit 1; fi
}

# 1 health
H=$(curl -sf "$BASE/api/health")
[ "$(echo "$H" | jget '["ok"]')" = "True" ] && [ "$(echo "$H" | jget '["data"]["db"]')" = "True" ]; check "GET /api/health ok + db" $?
if [ "$(echo "$H" | jget '["data"]["sim_connected"]')" = "True" ]; then echo "PASS  sim_connected"; else echo "WARN  sim_connected false (start the simulator)"; fi

# 2 admin login + me
LOGIN=$(curl -sf -X POST "$BASE/api/auth/login" -H 'content-type: application/json' -d '{"email":"admin@sentinel.demo","password":"sentinel"}')
TOKEN=$(echo "$LOGIN" | jget '["data"]["token"]')
[ "$(echo "$LOGIN" | jget '["data"]["role"]')" = "admin" ]; check "admin login" $?
ME=$(curl -sf "$BASE/api/auth/me" -H "authorization: Bearer $TOKEN")
[ "$(echo "$ME" | jget '["data"]["user"]["site_id"]')" = "1" ]; check "GET /api/auth/me site 1" $?

# 3 staff login
STAFF=$(curl -sf -X POST "$BASE/api/auth/staff" -H 'content-type: application/json' -d '{"staff_code":"T-3B-7Q2"}')
[ "$(echo "$STAFF" | jget '["data"]["class"]["name"]')" = "3B" ] && [ "$(echo "$STAFF" | jget '["data"]["class"]["roster_size"]')" = "30" ]; check "staff login 3B roster 30" $?
STAFF_TOKEN=$(echo "$STAFF" | jget '["data"]["token"]')

# 4 jump smoke -> decision card
curl -sf -X POST "$BASE/api/sim/control" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"action":"jump","t":"smoke"}' >/dev/null; check "sim control jump smoke" $?
sleep 3
CARD=$(curl -sf "$BASE/api/sites/1/overview" -H "authorization: Bearer $TOKEN")
[ "$(echo "$CARD" | jget '["data"]["decision_card"]["node_id"]')" = "field" ]; check "decision card at field after jump smoke" $?

# 5 trigger_fire gym
curl -sf -X POST "$BASE/api/sim/control" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"action":"trigger_fire","node_id":"gym"}' >/dev/null; check "sim control trigger_fire gym" $?
sleep 2
ALERTS=$(curl -sf "$BASE/api/alerts?open=true&site_id=1" -H "authorization: Bearer $TOKEN")
echo "$ALERTS" | "$PY" -c 'import json,sys; a=[x for x in json.load(sys.stdin)["data"] if x["kind"]=="LOCAL_FIRE"]; assert len(a)==1 and a[0]["node_id"]=="gym", a'; check "one LOCAL_FIRE at gym" $?
FIRE_ID=$(echo "$ALERTS" | "$PY" -c 'import json,sys; print([x for x in json.load(sys.stdin)["data"] if x["kind"]=="LOCAL_FIRE"][0]["id"])')

# 6 phone report
INC=$(curl -sf -X POST "$BASE/api/incidents" -H 'content-type: application/json' -H 'X-Device-Fp: smoke-device-1' -H 'X-Node-Id: gym' -d '{"type":"trapped","count":2,"text":"smoke test"}')
CODE=$(echo "$INC" | jget '["data"]["code"]')
[[ "$CODE" == SN-???? ]]; check "incident code $CODE" $?

# 7 responder acknowledge -> resolve
RLOGIN=$(curl -sf -X POST "$BASE/api/auth/login" -H 'content-type: application/json' -d '{"email":"responder@sentinel.demo","password":"sentinel"}')
RTOKEN=$(echo "$RLOGIN" | jget '["data"]["token"]')
curl -sf -X POST "$BASE/api/incidents/$CODE/events" -H "authorization: Bearer $RTOKEN" -H 'content-type: application/json' -d '{"action":"acknowledge","note":""}' >/dev/null; check "acknowledge" $?
curl -sf -X POST "$BASE/api/incidents/$CODE/events" -H "authorization: Bearer $RTOKEN" -H 'content-type: application/json' -d '{"action":"resolve","note":"smoke resolved"}' >/dev/null; check "resolve" $?
ST=$(curl -sf "$BASE/api/incidents/$CODE" -H 'X-Device-Fp: smoke-device-1')
[ "$(echo "$ST" | jget '["data"]["status"]')" = "resolved" ]; check "status resolved" $?

# 8 blocked device
BCODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/incidents" -H 'content-type: application/json' -H 'X-Device-Fp: demo-blocked-device' -H 'X-Node-Id: gym' -d '{"type":"water","count":1,"text":""}')
[ "$BCODE" = "403" ]; check "blocked device 403" $?

# 9 drill + rollcall
DRILL=$(curl -sf -X POST "$BASE/api/drills" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"site_id":1,"kind":"fire"}')
DID=$(echo "$DRILL" | jget '["data"]["id"]')
curl -sf -X POST "$BASE/api/drills/$DID/rollcall" -H "authorization: Bearer $STAFF_TOKEN" -H 'content-type: application/json' -d '{"class_id":2,"node_id":"field","present":28,"missing_refs":["S-3B-07","S-3B-19"]}' >/dev/null; check "rollcall 28 + 2 missing" $?
curl -sf "$BASE/api/export/drill/$DID.csv" -H "authorization: Bearer $TOKEN" | head -1 | grep -q ','; check "drill CSV" $?
curl -sf -X POST "$BASE/api/drills/$DID/end" -H "authorization: Bearer $TOKEN" >/dev/null; check "end drill" $?

# 13 WEA draft
WEA=$(curl -sf "$BASE/api/wea/draft?alert_id=$FIRE_ID" -H "authorization: Bearer $RTOKEN")
[ "$(echo "$WEA" | jget '["data"]["event_code"]')" = "FRW" ]; check "WEA draft FRW" $?

# 10 clear
curl -sf -X POST "$BASE/api/sim/control" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"action":"clear"}' >/dev/null; check "sim control clear" $?

echo "smoke: all curl checks passed"
