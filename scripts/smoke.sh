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
# Engine effects (decision card, LOCAL_FIRE) land a few wall-seconds after a control action at 60x.
# poll <seconds> <command...>: re-run the command until it exits 0 or the budget is spent.
poll() {
  local budget=$1; shift
  local i=0
  while ! "$@" >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -ge "$budget" ]; then "$@" >/dev/null || return 1; fi   # last try with stderr visible
    sleep 1
  done
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
# A previous run leaves a fire override in the simulator (clear() only decays it over 2 sim-minutes) and a
# backward jump re-anchors that fire to "now", so the gym would burn during the smoke check. Reset first.
SIM=$(curl -sf "$BASE/api/sim/state" -H "authorization: Bearer $TOKEN")
if echo "$SIM" | "$PY" -c 'import json,sys; o=json.load(sys.stdin)["data"].get("overrides") or {}; sys.exit(0 if (o.get("fire_nodes") or o.get("smoke_boost")) else 1)'; then
  curl -sf -X POST "$BASE/api/sim/control" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"action":"jump","t":"calm"}' >/dev/null; check "sim control jump calm (reset leftover overrides)" $?
  sleep 1
fi
JUMP=$(curl -sf -X POST "$BASE/api/sim/control" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"action":"jump","t":"smoke"}'); check "sim control jump smoke" $?
JUMP_TS=$(echo "$JUMP" | jget '["data"]["sim_ts"]')
card_at_field() {
  curl -sf "$BASE/api/sites/1/overview" -H "authorization: Bearer $TOKEN" \
    | "$PY" -c 'import json,sys; c=json.load(sys.stdin)["data"]["decision_card"]; assert c and c["node_id"]=="field", c'
}
poll 15 card_at_field && RC=0 || RC=1; check "decision card at field after jump smoke" $RC

# 5 trigger_fire gym
# CONTRACT §5.2: pm_rise/temp_rise compare against readings 5 min / 2 min back and are 0 when no such sample
# exists, so a fire lit right after a jump reads as LOCAL_SMOKE_SUSPECT. Let gym bank 5 sim-minutes first.
gym_has_history() {
  curl -sf "$BASE/api/nodes/gym/readings?minutes=10" -H "authorization: Bearer $TOKEN" \
    | "$PY" -c 'import json,sys; n=len([r for r in json.load(sys.stdin)["data"]["readings"] if r["ts"]>=sys.argv[1]]); assert n>=11, n' "$JUMP_TS"
}
poll 30 gym_has_history && RC=0 || RC=1; check "gym has 5 sim-min of readings after the jump" $RC
curl -sf -X POST "$BASE/api/sim/control" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"action":"trigger_fire","node_id":"gym"}' >/dev/null; check "sim control trigger_fire gym" $?
one_fire_at_gym() {
  curl -sf "$BASE/api/alerts?open=true&site_id=1" -H "authorization: Bearer $TOKEN" \
    | "$PY" -c 'import json,sys; a=[x for x in json.load(sys.stdin)["data"] if x["kind"]=="LOCAL_FIRE"]; assert len(a)==1 and a[0]["node_id"]=="gym", a'
}
poll 20 one_fire_at_gym && RC=0 || RC=1; check "one LOCAL_FIRE at gym" $RC
ALERTS=$(curl -sf "$BASE/api/alerts?open=true&site_id=1" -H "authorization: Bearer $TOKEN")
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

# 9 drill + rollcall (an aborted earlier run may have left a drill open; POST /drills would answer CONFLICT)
OPEN_DID=$(curl -sf "$BASE/api/drills/active?site_id=1" -H "authorization: Bearer $TOKEN" | "$PY" -c 'import json,sys; d=json.load(sys.stdin)["data"]; print(d["id"] if d else "")')
if [ -n "$OPEN_DID" ]; then
  curl -sf -X POST "$BASE/api/drills/$OPEN_DID/end" -H "authorization: Bearer $TOKEN" >/dev/null; check "end leftover drill $OPEN_DID" $?
fi
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
