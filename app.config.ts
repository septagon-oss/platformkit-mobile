// The app's configuration, as a function of two things the build says:
// PK_VERSION, the tag a release is cut from (v0.2.0 gives version 0.2.0 and
// a version code that only ever grows), and PK_PROFILE, which is "ci" for a
// verification build that must coexist with a real install on one device
// and carries the gallery route, and unset for a release, which has neither.
// Nothing here names a host it invented: EXPO_PUBLIC_API_URL is where the app
// connects, and it is the only host this manifest can claim. A verified app link
// is a fact about that deployment — the host publishes this binary's fingerprint
// at /.well-known/assetlinks.json — so a build that names no server carries the
// private scheme alone and claims no link it cannot vouch for.
import type { ExpoConfig } from "expo/config";
import { version as packageVersion } from "./package.json";

const profile = process.env.PK_PROFILE === "ci" ? "ci" : "release";
const tagged = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(process.env.PK_VERSION ?? "");
const version = tagged ? `${tagged[1]}.${tagged[2]}.${tagged[3]}` : `${packageVersion}-dev`;
const versionCode = tagged
  ? Number(tagged[1]) * 10000 + Number(tagged[2]) * 100 + Number(tagged[3])
  : 1;

type IntentFilters = NonNullable<NonNullable<ExpoConfig["android"]>["intentFilters"]>;

/**
 * appLinks is the build's one verified link, when it has one: the host of the server this
 * build connects to, opened only for the surface the generated shell lives on.
 *
 * An unverified link is refused here rather than carried: Android asks the host for
 * `/.well-known/assetlinks.json` and keeps nothing when the host says nothing, so a filter
 * for a host this build does not serve would open the browser all the same and leave a
 * claim nobody owns in the manifest. A port, a cleartext address and an address that is not
 * a URL all answer no filter, which is what leaves the private scheme — always declared by
 * `scheme` below — as the only way into a development build.
 */
export function appLinks(server: string): IntentFilters {
  let url: URL;
  try {
    url = new URL(server);
  } catch {
    return [];
  }
  if (url.protocol !== "https:" || url.hostname === "" || url.port !== "") return [];
  return [
    {
      autoVerify: true,
      action: "VIEW",
      data: { scheme: "https", host: url.hostname, pathPrefix: "/app/" },
      category: ["BROWSABLE", "DEFAULT"],
    },
  ];
}

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
    // The link a person taps in an e-mail, and the one a notification carries, are the same
    // address; the private scheme in `scheme` above is the other half, and needs no host.
    intentFilters: appLinks(process.env.EXPO_PUBLIC_API_URL ?? ""),
  },
  web: { bundler: "metro", output: "single" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-sqlite",
    "expo-font",
    "expo-image",
    // A body's figure may be a picture taken here: the module asks the platform for the
    // camera and the photo library when the person reaches for one, and says so in the
    // platform's own words rather than in a sentence this build invented.
    "expo-image-picker",
    // A notification arrives with the server's own words already rendered and points at the
    // address it is about; this build names no sound, icon or colour, which are a brand's.
    "expo-notifications",
    "@maplibre/maplibre-react-native",
    // A verification build talks plain HTTP to a server on the workstation
    // through adb reverse; a release never does.
    ["expo-build-properties", { android: { usesCleartextTraffic: profile === "ci" } }],
  ],
  experiments: { typedRoutes: true },
  extra: { gallery: profile === "ci" },
};

export default config;
