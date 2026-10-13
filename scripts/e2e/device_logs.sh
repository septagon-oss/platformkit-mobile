#!/usr/bin/env bash
# device_logs.sh prints what a device saw while a journey failed: the crash
# buffer, the process deaths and the app's own log lines, each bounded, to the
# job log and to a directory the job keeps. A journey that dies at its first
# `id: … is visible` says only that nothing appeared; the lines below are what
# says why — a FATAL EXCEPTION, an `am_crash`, or the JavaScript error that kept
# the first frame from rendering.
#
# Inputs. ANDROID_SERIAL names the device, as it does everywhere else in this
# harness: the CI job names the emulator it booted, an unqualified adb call is
# answered by whichever device the host happens to hold, and one attached device
# with nothing named is the workstation's own. PK_MOBILE_DIAGNOSTICS is the
# directory the same text is written to, default e2e/out/device, the sibling of
# the JUnit report, so the artifact holds what the job log printed — a device
# cannot be asked again after the emulator is gone. PK_MOBILE_DEBUG_DIR is read
# for one listing line that says what Maestro left behind.
#
# It never carries the verdict. No adb, a dead transport, an unreadable buffer:
# each is a line naming what is missing, and the script exits 0, because a step
# that fails after the journey would report its own failure instead of the
# journey's. That is why the job's own `continue-on-error` stays absent.
#
# What is deliberately not here: a screencap, a `uiautomator dump`, an
# `adb bugreport`. A screencap at this moment photographs the last flow's screen,
# not the failing one, and Maestro's debug bundle already holds the screenshot
# and the view hierarchy of the step that failed — which is the moment asked
# about. A bugreport is tens of megabytes nobody reads. What Maestro does *not*
# keep is what happened before a screen existed, and that is a device log.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
. "$(dirname "${BASH_SOURCE[0]}")/tools.sh"

out="${PK_MOBILE_DIAGNOSTICS:-e2e/out/device}"
debug="${PK_MOBILE_DEBUG_DIR:-e2e/out/debug}"

pk_tools device_logs.sh adb || exit 0

# read_buffer <name> <command…>: one device read, its header, its output and its
# failure printed to the job log and kept in <name>.log. The bound is the
# command's own `-t`, enforced on the device, so an unbounded read of a booted
# emulator is not a matter of how this script slices stdout.
read_buffer() {
  local name="$1"
  shift
  local raw="$out/$name.raw"
  local status=0
  printf '\n== %s: %s\n' "$name" "$*" | tee -a "$out/$name.log"
  # The status is taken with `||` and not around an `if !`: the condition of an if
  # reports its own inversion, and a failed read would be reported as a good one.
  "$@" >"$raw" 2>&1 || status=$?
  # The carriage returns come from the adb transport, not from the device.
  tr -d '\r' <"$raw" | tee -a "$out/$name.log"
  rm -f "$raw"
  if [ "$status" -ne 0 ]; then
    printf 'device_logs.sh: %s failed (status %s): nothing readable in it from this device.\n' \
      "$*" "$status" | tee -a "$out/$name.log" >&2
  fi
}

if ! mkdir -p "$out"; then
  echo "device_logs.sh: cannot write $out, so the job log holds what the device said and nothing is kept." >&2
fi

# The device first, because "the emulator died" and "the app crashed" are
# different causes with different owners, and every line below reads one device.
# `adb devices` is taken unqualified on purpose — `-s` does not narrow it, and
# the question here is how many devices this host holds (the same reading
# scripts/e2e/run.sh and the job's own boot step use).
printf '\n== the device this run drove\n' | tee -a "$out/device.log"
adb devices | tee -a "$out/device.log"
serial="${ANDROID_SERIAL:-}"
listed=$(adb devices | sed -nE 's/^([^[:space:]]+)[[:space:]]+[^[:space:]]+$/\1/p')
if [ -z "$serial" ]; then
  count=$(printf '%s\n' "$listed" | grep -c .)
  if [ "$count" -gt 1 ]; then
    # Nothing names the device and two answers: the one adb picks is a coin toss,
    # and a crash buffer read from another job's emulator is evidence about the
    # wrong run. The caller names it — the job does, from the boot step's output.
    printf 'device_logs.sh: %s devices are attached and none is named; set ANDROID_SERIAL to the emulator this job booted.\n' "$count" |
      tee -a "$out/device.log" >&2
    exit 0
  fi
fi
adb_cmd=(adb)
[ -n "$serial" ] && adb_cmd=(adb -s "$serial")
# The boot state is read through the named device; an empty answer is the
# emulator step's fact, said here rather than inferred from an empty crash log.
boot=$("${adb_cmd[@]}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' | tr -d '[:space:]')
printf 'sys.boot_completed: %s\n' "${boot:-nothing}" | tee -a "$out/device.log"
if [ "$boot" != "1" ]; then
  printf 'device_logs.sh: %s answers no sys.boot_completed; the buffers below are whatever this host still holds.\n' \
    "${serial:-the attached device}" | tee -a "$out/device.log" >&2
fi

# The three reads a first frame can fail in. The crash buffer carries the fatal
# one — `FATAL EXCEPTION`, the exception class, the frames, or a native signal.
# The events buffer names which process died even after the crash buffer rotated.
# The main buffer, filtered to React Native's own tags, is where a JavaScript
# error before render says itself (`Unable to resolve module`, `Invariant
# Violation`), with ActivityManager's `Force finishing` beside it. AndroidRuntime
# and System.err at :E catch a stack the JS tags only name.
read_buffer crash "${adb_cmd[@]}" shell logcat -v time -b crash -t 2000 -d
read_buffer deaths "${adb_cmd[@]}" shell logcat -v time -b events -t 500 \
  -s am_crash:V am_anr:V am_proc_died:V am_kill:V -d
read_buffer react-native "${adb_cmd[@]}" shell logcat -v time -b main -t 4000 \
  -s ReactNativeJS:V ReactNative:V ReactNativeBoot:V ReactNativeFabricAssertions:V \
  AndroidRuntime:E System.err:E ActivityManager:I -d

# What Maestro kept, listed and never printed: its bundle holds the screenshot
# and the hierarchy of the step that failed, and its logs carry what a journey
# typed, so the artifact is where those files belong and the job log is not.
# This line is the proof the run's own bundle exists at all.
printf '\n== what the Maestro run left in %s\n' "$debug" | tee -a "$out/maestro.log"
if [ -d "$debug" ]; then
  find "$debug" -maxdepth 3 -type f 2>/dev/null | head -40 |
    while read -r file; do
      printf '%s %s\n' "$(wc -c <"$file" | tr -d '[:space:]')" "$file"
    done | tee -a "$out/maestro.log"
else
  printf 'no Maestro debug directory at %s\n' "$debug" | tee -a "$out/maestro.log"
fi

exit 0
