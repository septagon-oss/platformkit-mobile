# The Android binary and what is done with it. `npm run check` remains the
# repository's required check; these targets build, mirror the runner, sign
# and install. Every build goes through scripts/android/build.sh.
#
#   make apk                  unsigned arm64 release APK in out/ (Docker, no SDK needed)
#   make apk ABIS=x86_64 PROFILE=ci   the verification build the emulator runs
#   make aab                  unsigned release AAB and universal APK, all ABIs
#   make apk-mirror           the same recipe under the CI daemon's limits (2 CPU, 4 GiB)
#   make apk-debug-sign       sign out/apk/release/*.apk with the SDK's debug key, for an emulator
#   make sign                 sign the release outputs with PK_KEYSTORE and friends, verify, checksum
#   make e2e-android          the Maestro flows against the emulator (see README)

IMAGE_TARGET := out
ABIS ?= arm64-v8a
PROFILE ?=
VERSION ?=
DOCKER ?= docker
OUT ?= out
# MIRROR_OUT is where the mirror copies its outputs; keep it absolute for the mount.
MIRROR_OUT ?= $(abspath $(OUT))-mirror
ANDROID_HOME ?= $(HOME)/Android/Sdk
BUILD_TOOLS := $(lastword $(sort $(wildcard $(ANDROID_HOME)/build-tools/*)))

.PHONY: apk aab apk-mirror apk-debug-sign sign e2e-android clean

apk:
	$(DOCKER) build -f Dockerfile.android --target $(IMAGE_TARGET) \
	  --build-arg ABIS=$(ABIS) --build-arg PK_PROFILE=$(PROFILE) --build-arg PK_VERSION=$(VERSION) \
	  --output type=local,dest=$(OUT) .
	@ls -la $(OUT)/apk/release/*.apk

aab:
	$(DOCKER) build -f Dockerfile.android --target $(IMAGE_TARGET) \
	  --build-arg ABIS=armeabi-v7a,arm64-v8a,x86,x86_64 --build-arg TARGETS=":app:assembleRelease :app:bundleRelease" \
	  --build-arg PK_PROFILE=$(PROFILE) --build-arg PK_VERSION=$(VERSION) \
	  --output type=local,dest=$(OUT) .
	@ls -la $(OUT)/apk/release/*.apk $(OUT)/bundle/release/*.aab

# The runner's daemon is 2 CPU / 4 GiB with no swap. A docker run with the
# same limits around the same recipe is the honest mirror; a cgroup around
# docker build would only limit the client.
apk-mirror:
	mkdir -p $(MIRROR_OUT)
	$(DOCKER) run --rm --cpus 2 --memory 4g --memory-swap 4g \
	  -e ABIS=$(ABIS) -e PK_PROFILE=$(PROFILE) -e PK_VERSION=$(VERSION) -e CI=1 \
	  -v pk-mobile-mirror-npm:/root/.npm -v pk-mobile-mirror-gradle:/root/.gradle \
	  -v "$(CURDIR):/src:ro" -v "$(MIRROR_OUT):/out" -w /tmp \
	  reactnativecommunity/react-native-android:v21.0@sha256:24ca7ab5a70ec0b78a81bdc5eeea5924c2531531d53971b6f2321aff08446c36 \
	  bash -c 'cp -r /src /tmp/app && cd /tmp/app && rm -rf node_modules android out; time scripts/android/build.sh; rc=$$?; echo "memory.peak $$(( $$(cat /sys/fs/cgroup/memory.peak) / 1048576 )) MiB"; cp -r android/app/build/outputs/* /out/ 2>/dev/null; exit $$rc'
	@ls -la $(MIRROR_OUT)/apk/release/ 2>/dev/null || echo "no APK: the recipe did not fit the runner's shape"

apk-debug-sign:
	@test -n "$(BUILD_TOOLS)" || (echo "no Android build-tools under $(ANDROID_HOME)"; exit 1)
	for f in $(OUT)/apk/release/*unsigned*.apk; do \
	  "$(BUILD_TOOLS)/zipalign" -f -p 4 "$$f" "$${f%-unsigned.apk}-debug-signed.apk" && \
	  "$(BUILD_TOOLS)/apksigner" sign --ks "$(HOME)/.android/debug.keystore" --ks-pass pass:android \
	    --ks-key-alias androiddebugkey "$${f%-unsigned.apk}-debug-signed.apk"; \
	done
	@ls -la $(OUT)/apk/release/*-debug-signed.apk

# The owner's key never leaves the owner's machine: PK_KEYSTORE is a path to
# it, PK_KEYSTORE_PASSWORD, PK_KEY_ALIAS and PK_KEY_PASSWORD complete it.
sign:
	@test -n "$(PK_KEYSTORE)" || (echo "set PK_KEYSTORE, PK_KEYSTORE_PASSWORD, PK_KEY_ALIAS, PK_KEY_PASSWORD"; exit 1)
	@test -n "$(BUILD_TOOLS)" || (echo "no Android build-tools under $(ANDROID_HOME)"; exit 1)
	for f in $(OUT)/apk/release/*unsigned*.apk; do \
	  s="$${f%-unsigned.apk}.apk"; \
	  "$(BUILD_TOOLS)/zipalign" -f -p 4 "$$f" "$$s" && \
	  "$(BUILD_TOOLS)/apksigner" sign --ks "$(PK_KEYSTORE)" --ks-pass env:PK_KEYSTORE_PASSWORD \
	    --ks-key-alias "$(PK_KEY_ALIAS)" --key-pass env:PK_KEY_PASSWORD "$$s" && \
	  "$(BUILD_TOOLS)/apksigner" verify --print-certs "$$s"; \
	done
	for b in $(OUT)/bundle/release/*.aab; do \
	  jarsigner -keystore "$(PK_KEYSTORE)" -storepass:env PK_KEYSTORE_PASSWORD -keypass:env PK_KEY_PASSWORD \
	    -sigalg SHA256withRSA -digestalg SHA-256 "$$b" "$(PK_KEY_ALIAS)" && \
	  keytool -printcert -jarfile "$$b" | head -5; \
	done
	cd $(OUT) && sha256sum apk/release/*.apk bundle/release/*.aab 2>/dev/null > SHA256SUMS && cat SHA256SUMS

e2e-android:
	scripts/e2e/android.sh

clean:
	rm -rf $(OUT) $(MIRROR_OUT) android
