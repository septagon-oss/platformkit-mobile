// The app's configuration, as a function of two things the build says:
// PK_VERSION, the tag a release is cut from (v0.2.0 gives version 0.2.0 and
// a version code that only ever grows), and PK_PROFILE, which is "ci" for a
// verification build that must coexist with a real install on one device
// and carries the gallery route, and unset for a release, which has neither.
// Nothing here names a host: where the app connects is typed at sign-in.
import type { ExpoConfig } from "expo/config";
import { version as packageVersion } from "./package.json";

const profile = process.env.PK_PROFILE === "ci" ? "ci" : "release";
const tagged = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(process.env.PK_VERSION ?? "");
const version = tagged ? `${tagged[1]}.${tagged[2]}.${tagged[3]}` : `${packageVersion}-dev`;
const versionCode = tagged
  ? Number(tagged[1]) * 10000 + Number(tagged[2]) * 100 + Number(tagged[3])
  : 1;

const config: ExpoConfig = {
  name: profile === "ci" ? "PlatformKit CI" : "PlatformKit",
  slug: "platformkit-mobile",
  scheme: "platformkit",
  version,
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: profile === "ci" ? "dev.septagon.platformkit.ci" : "dev.septagon.platformkit",
    buildNumber: String(versionCode),
  },
  android: {
    package: profile === "ci" ? "dev.septagon.platformkit.ci" : "dev.septagon.platformkit",
    versionCode,
    softwareKeyboardLayoutMode: "resize",
  },
  web: { bundler: "metro", output: "single" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    // A verification build talks plain HTTP to a server on the workstation
    // through adb reverse; a release never does.
    ["expo-build-properties", { android: { usesCleartextTraffic: profile === "ci" } }],
  ],
  experiments: { typedRoutes: true },
  extra: { gallery: profile === "ci" },
};

export default config;
