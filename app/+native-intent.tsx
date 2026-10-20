// +native-intent.tsx is the one file expo-router asks when the platform opened this app
// with a URL: its name is on the router's ignore list, so it is never a screen and draws
// nothing. The rule behind the answer is the route dispatcher's, which already owns arrival
// at a resource; this file only says which URL schemes the installed app declares for
// itself, so the scheme is read from the manifest that declares it and spelled nowhere twice.
//
// For a link the arrival rule does not read, the answer is the link as it arrived. The router
// calls its listener only when the answer is a string, and on a cold start the answer *is* the
// initial URL, so "leave it where it is" has to be spelled by handing the link back: an answer
// of nothing drops it, and the gallery and the command journeys are opened by scheme links that
// sit outside the workspace's own surface.
import { collectManifestSchemes } from "expo-linking";
import { systemHref } from "../src/route";

export function redirectSystemPath({ path }: { path: string | null; initial: boolean }) {
  return systemHref(path, collectManifestSchemes()) ?? path ?? undefined;
}
