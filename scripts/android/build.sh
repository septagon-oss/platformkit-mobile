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
# Output: android/app/build/outputs/{apk,bundle}/release/.
set -euo pipefail
cd "$(dirname "$0")/../.."

ABIS="${ABIS:-arm64-v8a}"
TARGETS="${TARGETS:-:app:assembleRelease}"
# Metro's transform workers, see metro.config.js.
export METRO_MAX_WORKERS="${METRO_MAX_WORKERS:-1}"

if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
fi

# Prebuild writes android/ from the app configuration and the installed
# modules; nothing in it is hand-edited, and it is ignored by git.
npx expo prebuild --platform android --no-install --clean

# The CI properties win over the template's: they are appended last.
cat scripts/android/gradle-ci.properties >> android/gradle.properties

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
  -PreactNativeArchitectures="$ABIS" -I ../scripts/android/signing.gradle --console=plain
