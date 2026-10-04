#!/usr/bin/env bash
# The last mile of a device journey: this repository's APK on the one attached
# device, the server the phone will type, and every flow in e2e/flows run once
# against them. It is scripts/e2e/android.sh's own last lines, extracted, so the
# workstation run and the CI run share one spec list and one report path.
#
# The spec list is the directory, never a list beside it — platformkit's
# scripts/mobile_e2e.sh:209-227 reads its flows from the manifest it declares and
# says why. Reading the directory is only honest because scripts/check_flows.ts
# refuses a flow in it that names no screen, a screen no flow names and a testID
# no component sets; that is what `npm run check` proves about the directory.
#
# Needs: one device on adb, the Maestro CLI, and a server the device reaches at
# SERVER. An address on this machine arrives through `adb reverse`: localhost on
# the emulator is this machine's localhost for the reversed port. A server that
# selects its tenant by host name is reached through scripts/e2e/proxy.ts — set
# UPSTREAM (its real address) and TENANT_HOST (the host it knows the tenant by),
# and SERVER to the proxy's own http://localhost:PORT.
#
# Every value a flow reads is passed with -e; none of them is committed, and no
# flow names a tenant, a host or a client. MODULE/ENTITY/KNOWN name a writable
# resource and its first writable string field (the one a row is recognised by);
# VERB/VERB_FIELD/VERB_TITLE name a lifecycle command, its one argument and the
# summary the API document gives it — the served kernel's vocabulary, which is
# why the job names all six and no script defaults them. TITLE is the stem of
# every record a journey makes; it defaults to a per-run stamp so no two runs
# share a name.
#
#   SERVER=http://localhost:8080 EMAIL=… PASSWORD=… MODULE=… ENTITY=… KNOWN=… \
#   VERB=… VERB_FIELD=… VERB_TITLE=… scripts/e2e/run.sh <apk>
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
. "$(dirname "${BASH_SOURCE[0]}")/tools.sh"

: "${SERVER:?the server URL as the phone reaches it, e.g. http://localhost:8080}"
: "${EMAIL:?an account on that tenant}"
: "${PASSWORD:?its password}"
: "${MODULE:?the module of a writable resource}"
: "${ENTITY:?its entity}"
: "${KNOWN:?its first writable string field}"
: "${VERB:?the verb of a lifecycle command on that server}"
: "${VERB_FIELD:?the one argument that command takes}"
: "${VERB_TITLE:?the summary the API document gives that command}"
apk="${1:?the verification APK to install (make apk ABIS=x86_64 PROFILE=ci && make apk-debug-sign)}"
TITLE="${TITLE:-Journey $(date +%H%M%S)}"
MAESTRO="${MAESTRO:-maestro}"
report="${PK_MOBILE_REPORT:-e2e/out/report.xml}"

pk_tools run.sh adb "$MAESTRO" || exit 1
[ -f "$apk" ] || {
  echo "run.sh: no APK at $apk; run make apk ABIS=x86_64 PROFILE=ci && make apk-debug-sign" >&2
  exit 1
}
# A device has to be attached for adb to have something to wait for: starting one
# is the caller's job, because the caller is the one that knows the image, the AVD
# and the GPU. scripts/e2e/mobile_ci.sh is the CI caller; a developer boots one.
adb devices | grep -qs 'device$' || {
  echo "run.sh: no device is attached. Boot the emulator (see .gitea/workflows/mobile-e2e.yml) or plug in a phone." >&2
  exit 1
}

adb wait-for-device
port=$(echo "$SERVER" | sed -nE 's#^[a-z]+://[^:/]+:([0-9]+).*$#\1#p')
if [ -n "${TENANT_HOST:-}" ]; then
  [ -n "$port" ] || {
    echo "run.sh: SERVER needs an explicit port when TENANT_HOST is set" >&2
    exit 1
  }
  npx tsx scripts/e2e/proxy.ts "$port" "${UPSTREAM:?the real address of the server, e.g. http://127.0.0.1:8080}" "$TENANT_HOST" &
  trap 'kill %1 2>/dev/null || true' EXIT
  sleep 1
fi
if [ -n "$port" ]; then adb reverse "tcp:$port" "tcp:$port"; fi
adb install -r "$apk" >/dev/null
echo "run.sh: installed $apk, running e2e/flows against $SERVER"

mkdir -p "$(dirname "$report")"
"$MAESTRO" test e2e/flows \
  -e SERVER="$SERVER" -e EMAIL="$EMAIL" -e PASSWORD="$PASSWORD" \
  -e MODULE="$MODULE" -e ENTITY="$ENTITY" -e KNOWN="$KNOWN" \
  -e VERB="$VERB" -e VERB_FIELD="$VERB_FIELD" -e VERB_TITLE="$VERB_TITLE" \
  -e TITLE="$TITLE" \
  --format junit --output "$report"
