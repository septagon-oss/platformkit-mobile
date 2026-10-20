// +native-intent.tsx is the one file expo-router asks when the platform opened this app
// with a URL: its name is on the router's ignore list, so it is never a screen and draws
// nothing. The rule behind the answer is the route dispatcher's, which already owns arrival
// at a resource; this file only says which URL schemes the installed app declares for
// itself, so the scheme is read from the manifest that declares it and spelled nowhere twice.
import { collectManifestSchemes } from "expo-linking";
import { systemHref } from "../src/route";

export function redirectSystemPath({ path }: { path: string | null; initial: boolean }) {
  return systemHref(path, collectManifestSchemes());
}
