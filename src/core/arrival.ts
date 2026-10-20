// arrival.ts reads a link. `reentry.ts` has always spelled an address; this file answers
// the other direction, which is what a link in an e-mail or a notification needs: the URL
// the platform handed the app says which two catalogue words, and at most one record, the
// person is reaching for. It is pure string work — no catalogue, no component, no SDK —
// because the same reading serves the launch that starts the app, the URL that arrives
// while it is open, and the tap on a notification. What it answers is *not* a route: an
// `Arrival` carries the words, and `reentry` stays the only place a route is spelled.
//
// What the rule refuses, and why:
// - a launch with no link, a link whose scheme belongs to another app, and a link that does
//   not open on the workspace's own surface all answer a refusal that changes nothing: the
//   router has always routed what it was given, and this rule speaks only for the addresses
//   the kernel writes — under `app`, the surface its generated shell is mounted on;
// - a link that *does* open on that surface and then breaks its shape answers `shape`, which
//   sends the person to the start of the app rather than to a path with no route file under
//   it — the router's own not-found page is a second visual language for "you cannot get
//   there", and it names nothing;
// - a host never decides anything. The tenant's address is where the person signed in
//   from, and an app link is claimed for it at build time, not read back out of the path.

import { screenPath } from "./derive";
import { rowAt } from "./reentry";

/** The surface every in-app address sits under: the kernel's `httpx.AppRoot`. */
export const APP_ROOT = "app";

/** An arrival is what a link names: a place, a resource's list, or one record. */
export type Arrival =
  | { readonly kind: "workspace" }
  | { readonly kind: "collection"; readonly module: string; readonly entity: string }
  | {
      readonly kind: "record";
      readonly module: string;
      readonly entity: string;
      readonly id: string;
    };

/**
 * LinkRefusal is why a link was not routed: nothing arrived, the link belongs to another
 * app, or its shape names no address. A refusal writes nothing, sends nothing and asks
 * nobody to fix anything in this app.
 */
export type LinkRefusal = "none" | "foreign" | "shape";

/** Reading is one link's whole answer: where it points, or why it points nowhere. */
export type Reading = { readonly arrival: Arrival } | { readonly refusal: LinkRefusal };

/** SCHEMES_ARE_HTTP are the spellings whose host carries the address and whose path is the address. */
const HTTP = new Set(["https", "http"]);

/**
 * SCHEME is a URL scheme at the start of a string: the grammar RFC 3986 allows, read
 * case-insensitively. A string with none is a path, which is how a remembered href and a
 * link written without a host both arrive.
 */
const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):([\s\S]*)$/;

const refused = (why: LinkRefusal): Reading => ({ refusal: why });

/**
 * segments splits a link into the parts of its in-app address, dropping the query and the
 * fragment (which name nothing here), the scheme and, for an HTTP link, the authority. For
 * a custom scheme the authority *is* the first path segment — `platformkit://app/…` puts
 * `app` where a host would be — so it joins the parts instead of being dropped.
 */
function segments(url: string, own: ReadonlySet<string>): string[] | undefined {
  const address = url.split(/[?#]/, 1)[0] ?? "";
  const found = SCHEME.exec(address);
  if (!found) return split(address);
  const name = found[1]?.toLowerCase() ?? "";
  let rest = found[2] ?? "";
  const authority = /^\/\/([^/]*)/.exec(rest)?.[1];
  if (authority !== undefined) rest = rest.slice(authority.length + 2);
  if (HTTP.has(name)) return split(rest);
  if (!own.has(name)) return undefined;
  const parts = split(rest);
  return authority === undefined || authority === "" ? parts : [authority, ...parts];
}

/**
 * split cuts a path into parts at its slashes, keeping the empty ones for the rule to refuse.
 * An address with no parts at all — the surface and nothing under it — is the empty list, not
 * a list holding one empty part, which is the difference between the start of the app and a
 * link that breaks its own shape.
 */
function split(path: string): string[] {
  const rest = path.startsWith("/") ? path.slice(1) : path;
  return rest === "" ? [] : rest.split("/");
}

/** decoded percent-decodes every part, or answers nothing when one of them will not decode. */
function decoded(parts: readonly string[]): string[] | undefined {
  const out: string[] = [];
  for (const part of parts) {
    if (part === "") return undefined;
    try {
      out.push(decodeURIComponent(part));
    } catch {
      return undefined;
    }
  }
  return out;
}

/**
 * read answers what one link says, given the URL schemes this build declares for itself.
 *
 * The input is the whole URL exactly as the platform gave it — a launch may carry nothing
 * at all, which is the home-screen start and not a refusal of anything. The answer is the
 * two catalogue words and at most one id, percent-decoded once and otherwise untouched:
 * whether they name a place in this installation is the catalogue's question, asked where
 * the catalogue is, and a link to a record nobody may read is refused by the read itself.
 */
export function read(url: string | null | undefined, schemes: readonly string[]): Reading {
  if (url === undefined || url === null || url === "") return refused("none");
  const own = new Set(schemes.map((scheme) => scheme.toLowerCase()));
  // No parts at all means the scheme was nobody's but another app's.
  const parts = segments(url, own);
  if (parts === undefined) return refused("foreign");
  // The surface is spelled plainly or not at all: a link that does not open on it is not
  // this rule's to read, and goes where the router has always taken it.
  if (parts[0] !== APP_ROOT) return refused("foreign");
  const below = decoded(parts.slice(1));
  if (below === undefined) return refused("shape");
  // Zero parts is the workspace itself; one part names half a resource, and four or more
  // name a screen under a record — a sheet or a command — which no link is written for.
  if (below.length === 0) return { arrival: { kind: "workspace" } };
  const [module, entity, id] = below;
  if (module === undefined || entity === undefined) return refused("shape");
  if (below.length === 2) return { arrival: { kind: "collection", module, entity } };
  if (below.length === 3 && id !== undefined)
    return { arrival: { kind: "record", module, entity, id } };
  return refused("shape");
}

/**
 * systemHref turns a URL the platform opened this app with into the route it points at,
 * which is the whole answer for a link in an e-mail, a link from another app and the address
 * a notification carries.
 *
 * It answers `undefined` — leave the link exactly where it was — for a launch that carried no
 * link and for a scheme this build does not declare, because that link is another app's
 * business. Anything else lands somewhere real: an address shape this app does not have
 * opens the start of the app, since a path with no route file under it draws the router's
 * own not-found page — a second visual language for "you cannot get there" that names
 * nothing. Whether a record at a well-shaped address may be read is not asked here; the
 * screen that arrives asks that of the server and draws the kit's refusal.
 */
export function systemHref(
  url: string | null | undefined,
  schemes: readonly string[],
): string | undefined {
  const reading = read(url, schemes);
  if ("refusal" in reading) return reading.refusal === "shape" ? "/" : undefined;
  const at = reading.arrival;
  if (at.kind === "workspace") return "/";
  return at.kind === "collection" ? screenPath(at) : rowAt(at.module, at.entity, at.id);
}
