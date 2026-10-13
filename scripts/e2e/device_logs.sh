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
# for one listing line that says what Maestro left behind. PK_MOBILE_READ_TIMEOUT
# is how long one read may take before this script ends it, default 60 seconds:
# the `-t` a read carries bounds how far back the device goes and `-d` makes it
# finish once it answers, and neither is a bound on waiting for an answer.
#
# That directory is written to and never depended on. Every line below reaches the
# job log whichever filesystem answer the copy meets, because a run that cannot
# write to e2e/out — a full disk, a workspace a previous job left owned by someone
# else — still owes the reader the device's lines, and says once that it is
# keeping no copy.
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
read_seconds="${PK_MOBILE_READ_TIMEOUT:-60}"

pk_tools device_logs.sh adb || exit 0

# Whether a copy can be kept at all, asked once here rather than at each write.
# The probe is a write and not a `test -w`: root is told a read-only mount is
# writable, and a directory that fills mid-run is not what this decides — a copy
# that fails after this point is named by whatever writes it.
keep=1
mkdir -p "$out" 2>/dev/null || keep=0
if [ "$keep" = 1 ] && ! : >>"$out/.keep" 2>/dev/null; then
  keep=0
fi
rm -f "$out/.keep" 2>/dev/null
if [ "$keep" != 1 ]; then
  printf 'device_logs.sh: nothing can be written to %s, so this run keeps no copy of what follows; the job log holds every line of it.\n' "$out" >&2
fi

# keep_copy <name>: a section's text, to the job log and to this run's kept copy
# in <name>.log while that directory answers. The copy is a copy: no read, no
# line and no status below waits on it, so what the artifact loses is the copy and
# not what the reader of the job log reads.
keep_copy() {
  if [ "$keep" = 1 ]; then
    tee -a "$out/$1.log"
  else
    cat
  fi
}

# pk_deadline <seconds> <command…>: the command's output and its exit status, with
# the command ended if it is still running when <seconds> have passed, answered as
# status 124 — the status timeout(1) would have used. A device whose adbd has wedged
# answers no logcat at all, and a step that waits for it waits until the job's own
# ceiling, past the artifact step and past the emulator teardown below it.
# `timeout(1)` cannot stand in here: it execs a program by name and cannot end the
# shell function a caller stands in for adb. The watchdog holds no output descriptor
# of the caller's — a `sleep` left holding the job's stdout is a run that never sees
# its own end — and the deadline is said by the caller rather than from here, because
# a read's lines are on stdout and its failures on stderr, and a line printed here
# would land in whichever of the two the caller happened to redirect.
pk_deadline() {
  local seconds="$1" status=0 pid watchdog
  shift
  "$@" &
  pid=$!
  { sleep "$seconds" && kill -0 "$pid" 2>/dev/null && kill -TERM "$pid"; } >/dev/null 2>&1 &
  watchdog=$!
  # The status is taken with `||` and not around an `if !`: the condition of an if
  # reports its own inversion, and a killed read would be reported as a good one.
  wait "$pid" || status=$?
  kill "$watchdog" 2>/dev/null
  wait "$watchdog" 2>/dev/null
  # This script sends a read no signal but its own watchdog's, so a death by SIGTERM
  # is the deadline expiring and nothing else.
  [ "$status" -eq 143 ] && return 124
  return "$status"
}

# read_buffer <name> <command…>: one device read, its header, its output and its
# failure printed to the job log and kept in <name>.log. Two bounds, and they say
# different things: the command's own `-t`, enforced on the device, so an unbounded
# read of a booted emulator is not a matter of how this script slices stdout, and
# this script's deadline, for the device that answers nothing at all.
read_buffer() {
  local name="$1"
  shift
  local status=0
  printf '\n== %s: %s\n' "$name" "$*" | keep_copy "$name"
  # The read's own status is the first element's, not the pipeline's: the copy at
  # its end fails for reasons of the filesystem, which are the reader's to hear
  # from the copy and never as a dead device.
  pk_deadline "$read_seconds" "$@" 2>&1 | tr -d '\r' | keep_copy "$name"
  status=${PIPESTATUS[0]}
  if [ "$status" -eq 124 ]; then
    printf 'device_logs.sh: %s answered nothing in %ss and was ended.\n' "$*" "$read_seconds" |
      keep_copy "$name" >&2
  elif [ "$status" -ne 0 ]; then
    printf 'device_logs.sh: %s failed (status %s): that read reached no answer from this device.\n' \
      "$*" "$status" | keep_copy "$name" >&2
  fi
}

# The device first, because "the emulator died" and "the app crashed" are
# different causes with different owners, and every line below reads one device.
# `adb devices` is taken unqualified on purpose — `-s` does not narrow it, and
# the question here is how many devices this host holds (the same reading
# scripts/e2e/run.sh and the job's own boot step use).
printf '\n== the device this run drove\n' | keep_copy device
# One read of what this host holds, printed and then parsed: two calls would be two
# chances to disagree about the device list, and this is one of the calls a wedged
# adb server can hold open forever.
devices=$(pk_deadline "$read_seconds" adb devices)
printf '%s\n' "$devices" | keep_copy device
serial="${ANDROID_SERIAL:-}"
listed=$(printf '%s\n' "$devices" | sed -nE 's/^([^[:space:]]+)[[:space:]]+[^[:space:]]+$/\1/p')
if [ -z "$serial" ]; then
  count=$(printf '%s\n' "$listed" | grep -c .)
  if [ "$count" -gt 1 ]; then
    # Nothing names the device and two answers: the one adb picks is a coin toss,
    # and a crash buffer read from another job's emulator is evidence about the
    # wrong run. The caller names it — the job does, from the boot step's output.
    printf 'device_logs.sh: %s devices are attached and none is named; set ANDROID_SERIAL to the emulator this job booted.\n' "$count" |
      keep_copy device >&2
    exit 0
  fi
fi
adb_cmd=(adb)
[ -n "$serial" ] && adb_cmd=(adb -s "$serial")
# The boot state is read through the named device; an empty answer is the
# emulator step's fact, said here rather than inferred from an empty crash log. No
# 2>/dev/null: what adb says when the device is gone ("error: device 'emulator-5584'
# not found") is the reader's evidence for a transport that died mid-run.
boot=$(pk_deadline "$read_seconds" "${adb_cmd[@]}" shell getprop sys.boot_completed)
boot_status=$?
# The carriage returns come from the adb transport, not from the device, and the
# answer is one word, so it is stripped here rather than by a pipe that would take
# the read's own status out of reach.
boot="${boot//[[:space:]]/}"
printf 'sys.boot_completed: %s\n' "${boot:-nothing}" | keep_copy device
if [ "$boot" != "1" ]; then
  answer="answers no sys.boot_completed"
  [ "$boot_status" -eq 124 ] &&
    answer="answered nothing to sys.boot_completed in ${read_seconds}s and was ended"
  printf 'device_logs.sh: %s %s; the buffers below are whatever this host still holds.\n' \
    "${serial:-the attached device}" "$answer" | keep_copy device >&2
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
printf '\n== what the Maestro run left in %s\n' "$debug" | keep_copy maestro
if [ -d "$debug" ]; then
  find "$debug" -maxdepth 3 -type f 2>/dev/null | head -40 |
    while read -r file; do
      printf '%s %s\n' "$(wc -c <"$file" | tr -d '[:space:]')" "$file"
    done | keep_copy maestro
else
  printf 'no Maestro debug directory at %s\n' "$debug" | keep_copy maestro
fi

exit 0
