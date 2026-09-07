#!/usr/bin/env bash
# The device journeys on the workstation's emulator. Needs: a booted Android
# emulator or device on adb, a Maestro CLI (MAESTRO, default `maestro` on
# PATH), the verification APK signed for the emulator
# (make apk ABIS=x86_64 PROFILE=ci && make apk-debug-sign), and a reachable
# server with an account: SERVER, EMAIL, PASSWORD, and a writable resource
# MODULE/ENTITY whose first writable string field is KNOWN. The server URL is
# what the phone would type, so an address on the workstation is reached
# through `adb reverse` (localhost on the emulator is the workstation's
# localhost for the reversed port). A server that selects its tenant by host
# name is reached through scripts/e2e/proxy.ts: set UPSTREAM (its real
# address) and TENANT_HOST (the host it knows the tenant by), and SERVER to
# the proxy's http://localhost:PORT. None of these values are committed.
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${SERVER:?the server URL as the phone reaches it, e.g. http://acme.localhost:8080}"
: "${EMAIL:?an account on that tenant}"
: "${PASSWORD:?its password}"
: "${MODULE:?the module of a writable resource}"
: "${ENTITY:?its entity}"
: "${KNOWN:?its first writable string field}"
MAESTRO="${MAESTRO:-maestro}"
OUT="${OUT:-out}"
TITLE="${TITLE:-Journey $(date +%H%M%S)}"

apk=$(ls "$OUT"/apk/release/*-debug-signed.apk 2>/dev/null | head -1)
[ -n "$apk" ] || { echo "no debug-signed verification APK in $OUT; run make apk ABIS=x86_64 PROFILE=ci && make apk-debug-sign" >&2; exit 1; }

adb wait-for-device
port=$(echo "$SERVER" | sed -nE 's#^[a-z]+://[^:/]+:([0-9]+).*$#\1#p')
if [ -n "$port" ]; then adb reverse "tcp:$port" "tcp:$port"; fi
if [ -n "${TENANT_HOST:-}" ]; then
  [ -n "$port" ] || { echo "SERVER needs an explicit port when TENANT_HOST is set" >&2; exit 1; }
  npx tsx scripts/e2e/proxy.ts "$port" "${UPSTREAM:?the real address of the server, e.g. http://127.0.0.1:8080}" "$TENANT_HOST" &
  trap 'kill %1 2>/dev/null || true' EXIT
  sleep 1
fi
adb install -r "$apk" >/dev/null
echo "installed $apk"

mkdir -p e2e/out
"$MAESTRO" test e2e/flows/gallery.yaml e2e/flows/sign-in.yaml e2e/flows/record.yaml e2e/flows/sign-out.yaml \
  -e SERVER="$SERVER" -e EMAIL="$EMAIL" -e PASSWORD="$PASSWORD" \
  -e MODULE="$MODULE" -e ENTITY="$ENTITY" -e KNOWN="$KNOWN" -e TITLE="$TITLE" \
  --format junit --output e2e/out/report.xml
