#!/usr/bin/env bash
# The one recipe that turns this source into an Android binary. The
# Dockerfile runs it inside the pinned build image; `make apk-mirror` runs it
# in that same image under the CI daemon's limits; a developer with the SDK
# may run it directly. Inputs are environment variables, all optional:
#   ABIS       architectures to compile, comma separated (default arm64-v8a)
#   TARGETS    Gradle tasks (default :app:assembleRelease; add :app:bundleRelease for an AAB)
#   PK_PROFILE "ci" for a verification build (see app.config.ts)
#   PK_VERSION the tag a release is cut from, v0.2.0
#   PK_KEYSTORE and friends: see signing.gradle; unset means an unsigned output
# Pass an Expo application directory to build a consuming application with
# this same installed recipe. With no argument, build this reference app.
# Output: <application>/android/app/build/outputs/{apk,bundle}/release/.
set -euo pipefail
recipe_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if [ "$#" -gt 1 ]; then
  echo 'usage: build.sh [expo-application-directory]' >&2
  exit 2
fi
application_dir="${1-$recipe_dir/../..}"
if [ -z "$application_dir" ] || [ ! -d "$application_dir" ]; then
  echo 'android: the application directory does not exist' >&2
  exit 2
fi
application_dir="$(cd -- "$application_dir" && pwd -P)"
if [ ! -f "$application_dir/package.json" ] || [ ! -f "$application_dir/package-lock.json" ] ||
   { [ ! -f "$application_dir/app.config.ts" ] && [ ! -f "$application_dir/app.config.js" ] && [ ! -f "$application_dir/app.json" ]; }; then
  echo 'android: choose an Expo application with package.json, package-lock.json and app configuration' >&2
  exit 2
fi
cd -- "$application_dir"

ABIS="${ABIS:-arm64-v8a}"
TARGETS="${TARGETS:-:app:assembleRelease}"
# Metro's transform workers, see metro.config.js.
export METRO_MAX_WORKERS="${METRO_MAX_WORKERS:-1}"

if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
fi

# Prebuild writes android/ from the app configuration and the installed
# modules; nothing in it is hand-edited, and it is ignored by git.
./node_modules/.bin/expo prebuild --platform android --no-install --clean

# The CI properties win over the template's: they are appended last. The
# newline matters: the generated file does not end with one, so without it the
# first line here is glued onto the last property's value, which turns a
# setting into nonsense that fails much later and elsewhere.
printf '\n' >> android/gradle.properties
cat "$recipe_dir/gradle-ci.properties" >> android/gradle.properties

# Ninja sizes its job pool from the CPUs the process may run on, not from a
# container's CPU quota, so on a many-core host a 2-CPU build would spawn a
# compiler per core and run out of memory. Pin to the first two CPUs allowed.
allowed=$(grep Cpus_allowed_list /proc/self/status | awk '{print $2}')
first=${allowed%%[-,]*}
pin="$first"
case "$allowed" in
  "$first"-*) pin="$first-$((first + 1))" ;;
  "$first",*) pin="$first,$(echo "$allowed" | cut -d, -f2 | cut -d- -f1)" ;;
esac

cd android
# shellcheck disable=SC2086
exec taskset -c "$pin" ./gradlew $TARGETS --no-daemon --max-workers=1 \
  -PreactNativeArchitectures="$ABIS" -I "$recipe_dir/signing.gradle" --console=plain
