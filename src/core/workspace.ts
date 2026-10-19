// workspace.ts is what one workspace looks like to a phone: the name it calls itself,
// the colour it wears and the mark it hands out, all read from the workspace's own
// document, and the list of hosts this device has seen one on. Nothing here names a
// person: `GET /api/v1/app/connection` is the kernel's public door, so what it answers
// belongs to a device and travels with no session. Where that colour may be painted
// without stranding an ink is the theme's rule (src/ui/theme.tsx), and where the name is
// read is derive's (`workspaceName`), which this file feeds rather than restates.
import { z } from "zod";
import type { Connection } from "../generated/types.gen";
import { hostLabel } from "./derive";

/**
 * ACCENT is the one spelling a brand accent arrives in: six hex digits behind a hash, in
 * either case, since a colour is the same colour written either way.
 * The document says only "Brand accent, #rrggbb" and its generated validator only that
 * the field is a string, so the shape is checked here rather than trusted — a colour
 * this file cannot read is not painted anywhere, and a phone does not guess one.
 */
export const ACCENT = /^#[0-9a-fA-F]{6}$/;

/**
 * Workspace is one workspace as a phone can see it, with nothing about a person in it.
 *
 * `server` is the origin the answer arrived from, normalised to the one spelling a held
 * write's scope uses (`workspaceServer`), and `host` that origin reduced to what a person
 * typed (`hostLabel`) — the two are not one field wearing two names: one is where the
 * bytes are and the other is what a screen says out loud, and an address whose host cannot
 * be read still names where the answer came from. `name` is the word the workspace used for
 * itself already trimmed — empty when it was told nothing, which is what sends a screen to
 * the address and then to the copy table's own word through `workspaceName` — `accent` the
 * lower-cased colour a person may paint, and `logoPath` the mark's path *on that host*.
 * A workspace is identified by its server origin and nothing else: a re-read replaces every
 * field, so a colour, a name and a mark never outlive the answer that carried them, and a
 * mark can never be asked of a server other than the one that named it.
 */
export interface Workspace {
  readonly server: string;
  readonly host: string;
  readonly name: string;
  readonly accent?: string | undefined;
  readonly logoPath?: string | undefined;
}

/**
 * markPath keeps a mark that is this installation's own door. A path is what the
 * document names; an absolute URL — or a scheme-relative one — points at a server other
 * than the host that named it, and a phone does not fetch a stranger's bytes to draw a
 * logo beside a password field.
 */
const markPath = (logoUrl: string | undefined): string | undefined => {
  const path = logoUrl?.trim() ?? "";
  if (path === "" || !path.startsWith("/") || path.startsWith("//")) return undefined;
  return path;
};

/**
 * workspaceOf reduces an answered connection document to what a phone wears.
 *
 * Inputs: the validated body (so `name` and `accent` are present as strings) and the
 * address it was read from. The accent is kept only in the spelling `ACCENT` names and
 * lower-cased, so one colour is one value; the mark is kept only as a local path.
 * Nothing is fetched, cached or defaulted here, and a document with nothing to say
 * answers a workspace whose `name` is empty — today's look, not a failure.
 */
export const workspaceOf = (answer: Connection, baseURL: string): Workspace => {
  const server = workspaceServer(baseURL);
  const name = answer.name.trim();
  const accent = answer.accent.trim();
  const path = markPath(answer.logoUrl);
  return Object.freeze({
    server,
    host: hostLabel(server),
    name,
    ...(ACCENT.test(accent) ? { accent: accent.toLowerCase() } : {}),
    ...(path === undefined ? {} : { logoPath: path }),
  });
};

/**
 * workspaceServer normalises an address to the origin its workspace is filed under, the
 * way `scopeOf` normalises a server: a trailing slash is the same workspace. A host that
 * cannot be read at all stays the trimmed text, because that is what the address field
 * holds and what a remembered row has to fill again.
 */
export const workspaceServer = (server: string): string => server.trim().replace(/\/+$/, "");

/**
 * workspaceMarkURI is where a phone asks for the mark a workspace named: that workspace's
 * own origin joined to the path it named, and nothing else.
 *
 * The face carries the origin precisely so the address a screen asks cannot be chosen at the
 * call site: a phone that changed the address, or that was built against another server, has
 * no way to send a stranger's file path to a stranger's host. Empty — no mark named, or an
 * origin that is no http(s) address — draws no image rather than a broken one.
 */
export const workspaceMarkURI = (workspace: Workspace): string =>
  workspace.logoPath === undefined || workspace.host === ""
    ? ""
    : workspace.server + workspace.logoPath;

/**
 * WORKSPACES_KEEP is how many workspaces one phone may remember. Eight is a person's
 * own handful of installations — a laptop work, a personal workspace, a client's, a
 * staging host — and the bound is what stops a shared tablet from growing a list nobody
 * reads.
 */
export const WORKSPACES_KEEP = 8;

/** WORKSPACES_SHOWN is how many remembered workspaces the connect step lists. */
export const WORKSPACES_SHOWN = 5;

/**
 * rememberedRecord is one row of `workspace_seen`: the server's origin, the name and mark
 * that origin answered for itself, and the moment this phone last saw it in UTC. It holds
 * no token, no email and no cookie — the shape has no slot for one, which is why a
 * remembered workspace can fill an address and never sign anybody in.
 */
export const rememberedRecord = z.object({
  host: z.string().min(1),
  name: z.string().min(1),
  logoPath: z.string().min(1).optional(),
  seenAt: z.string().min(1),
});

export type Remembered = Readonly<z.infer<typeof rememberedRecord>>;

/** rememberedFrom parses one stored row; a row that fails it is dropped by the reader, not repaired here. */
export function rememberedFrom(value: unknown): Remembered {
  return rememberedRecord.parse(value);
}

/**
 * rememberedStamp files what a workspace answered as a row this device may keep, with the
 * moment from the caller's clock.
 *
 * The row is filed under the origin the face was read from — the same normalisation a held
 * write's scope uses, so a trailing slash is one workspace and not two — which is the only
 * origin a caller can name here: a row cannot be filed under an address other than the one
 * that answered. An entry with no address has nowhere to go back to and one with no name has
 * nothing to show, so both answer undefined rather than a row: an unanswered address is a
 * typo, not a workspace, and is never remembered.
 */
export const rememberedStamp = (workspace: Workspace, seenAt: string): Remembered | undefined => {
  const host = workspace.server;
  const name = workspace.name.trim();
  if (host === "" || name === "") return undefined;
  return rememberedRecord.parse({
    host,
    name,
    ...(workspace.logoPath === undefined ? {} : { logoPath: workspace.logoPath }),
    seenAt,
  });
};

/**
 * rememberedFace reads a kept row back as the face it was stamped from: the origin it was
 * answered at, the name and the mark that answer carried.
 *
 * A remembered row carries no accent, and that is the shape of what is kept rather than an
 * omission: a colour is worn by the app a person is signing in to, and one kept from a place
 * they are not standing at would be a palette for nobody. The mark is kept because the row
 * draws it — a list of workspaces this phone has been at is read by their marks, the same way
 * the connect step itself is.
 */
export const rememberedFace = (entry: Remembered): Workspace =>
  Object.freeze({
    server: entry.host,
    host: hostLabel(entry.host),
    name: entry.name,
    ...(entry.logoPath === undefined ? {} : { logoPath: entry.logoPath }),
  });

/**
 * unknownWorkspace is what a phone knows of a place before anything answered: where it was
 * asked, and nothing else. Screens read a Workspace whatever its state, so "no document" is a
 * value here rather than a branch every screen would have to carry.
 */
export const unknownWorkspace = (baseURL: string): Workspace =>
  Object.freeze({ server: workspaceServer(baseURL), host: hostLabel(baseURL), name: "" });
