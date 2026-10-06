#!/usr/bin/env bash
# The device journeys on the workstation's emulator: this checkout's
# debug-signed verification APK on the device already on adb, and every flow in
# e2e/flows run against a server somebody else started. Needs
# `make apk ABIS=x86_64 PROFILE=ci && make apk-debug-sign`, a booted emulator or
# a phone on adb, and the env contract scripts/e2e/run.sh states: SERVER, EMAIL,
# PASSWORD, a writable resource MODULE/ENTITY with its first writable string
# field KNOWN, a lifecycle command VERB with its argument VERB_FIELD and the
# summary the API document gives it VERB_TITLE, and optionally TITLE (default: a
# per-run stamp), TENANT_HOST/UPSTREAM (a server that selects its tenant by host
# name) and MAESTRO. None of those values is committed.
#
# The CI job runs the same flows against a kernel it serves itself — see
# scripts/e2e/mobile_ci.sh and .gitea/workflows/mobile-e2e.yml. Both runners end
# at scripts/e2e/run.sh, so neither keeps a flow list of its own.
set -euo pipefail
cd "$(dirname "$0")/../.."

OUT="${OUT:-out}"
apk=$(ls "$OUT"/apk/release/*-debug-signed.apk 2>/dev/null | head -1 || true)
[ -n "$apk" ] || {
  echo "no debug-signed verification APK in $OUT; run make apk ABIS=x86_64 PROFILE=ci && make apk-debug-sign" >&2
  exit 1
}

exec scripts/e2e/run.sh "$apk"
