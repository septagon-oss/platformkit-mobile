# tools.sh puts the Android and Maestro binaries on PATH for a shell that has
# them and no export to say so, and says what "missing" meant. Source it, do not
# run it:
#
#   . "$(dirname "${BASH_SOURCE[0]}")/tools.sh"
#
# The search is the one from platformkit's scripts/mobile_e2e.sh:53-63, copied
# and cited: the host that carries the SDK has adb and the emulator under
# $ANDROID_HOME, $ANDROID_SDK_ROOT or ~/Android/Sdk with nothing exported at all,
# and Maestro is a launch script plus a lib directory, so the host that has it
# keeps it under a tools prefix of its own — $MAESTRO_HOME, or
# ~/.local/share/platformkit-tools/maestro/bin where that loop's tooling puts it.
# "Missing" means *nowhere it is looked for*, so the search scope is part of any
# claim about a tool (platformkit's e2e/maestro/README.md:20-28). A tool that
# exists and is not looked for is a journey that reports itself impossible.
_pk_tool_paths=""
for _dir in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Android/Sdk"; do
  [ -n "$_dir" ] || continue
  for _part in platform-tools emulator; do
    if [ -x "$_dir/$_part" ]; then
      PATH="$_dir/$_part:$PATH"
      _pk_tool_paths="$_pk_tool_paths $_dir/$_part"
    fi
  done
done
for _dir in "${MAESTRO_HOME:-}" "${MAESTRO_HOME:+$MAESTRO_HOME/bin}" "${XDG_DATA_HOME:-$HOME/.local/share}/platformkit-tools/maestro/bin"; do
  [ -n "$_dir" ] || continue
  if [ -x "$_dir/maestro" ]; then
    PATH="$_dir:$PATH"
    _pk_tool_paths="$_pk_tool_paths $_dir"
  fi
done
export PATH

# pk_tools refuses for what a host has nowhere it was looked for, and prints the
# path of everything it did find. The path, not just the name: "found" is a claim
# about a search scope, and the next reader needs to see which scope this one had.
# Each caller names what *it* needs — a job that boots an emulator owes more than
# a run that only drives one — and none of them owes a tool its journey never
# wanted.
pk_tools() {
  local who="$1"
  shift
  local -a missing=()
  local tool
  for tool in "$@"; do
    command -v "$tool" >/dev/null || missing+=("$tool")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "$who: this host cannot run a device journey; missing: ${missing[*]}," >&2
    echo "  searched: $PATH" >&2
    return 1
  fi
  for tool in "$@"; do echo "$tool: $(command -v "$tool")"; done
}

unset _dir _part
