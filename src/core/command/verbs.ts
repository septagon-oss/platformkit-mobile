/** verbs: which command a row or a collection offers, and where the request goes. */
import { Command, CrudVerb, Entry } from "../catalog";
import { isKeeping } from "../saved";
import { printed, rowPlaceholder } from "../internals";

/**
 * offered excludes what the catalogue marks `system`: a command the kernel runs
 * for its own reasons is never a choice a person is given. `commandOf` and
 * `commandAt` keep resolving it, deliberately: an address someone already holds
 * still reaches it, and the kernel guards the door. Hiding the address too needs
 * a sentence in both languages, which is copy work, not a filter.
 */
export const offered = (c: Command): boolean => c.hints?.system !== true;

/**
 * rowCommands are the commands about one record; collectionCommands are about the list.
 * Neither offers one of the two keeping writes: `isKeeping` says why — a person never types
 * a source or a revision, so a form asking for either would be a second, false door onto
 * the act the heart does. They stay resolvable by `commandOf`, like a system command.
 */
export const rowCommands = (e: Entry): readonly Command[] =>
  e.commands.filter((c) => !c.collection && offered(c) && !isKeeping(c));

export const collectionCommands = (e: Entry): readonly Command[] =>
  e.commands.filter((c) => c.collection === true && offered(c) && !isKeeping(c));

/**
 * CommandScope is the address a command was opened at, which is the whole of
 * what "about one record" and "about the collection" mean on screen: the
 * address either has a row to name or it does not.
 *
 * The command and the address have to agree, because the POST is derived from
 * both — `{entry.path}/{id}/{verb}`, or `{entry.path}/{verb}` when collection
 * (catalog.Command). A record command opened at the collection's address would
 * POST to the address only a collection command mounts, and a collection command
 * opened at a record's would name a row to a door that takes none. The sheet is
 * drawn from the catalog alone, so nothing else would notice until the write
 * came back 404 with the argument somebody typed still in the box.
 *
 * The test is the one `api.command` already makes of the id it is handed
 * (`id ? path/id : path`); naming it here is what lets the screen refuse before
 * anybody fills in a sheet. The two screens that *navigate* to these addresses
 * already scope themselves (`rowCommands` from a record, `collectionCommands`
 * from a list): only an address typed or deep-linked from outside can mismatch.
 */
export type CommandScope = "record" | "collection";

/** commandAt says whether a command belongs at an address; otherScope is the other one. */
export const commandAt = (c: Command, at: CommandScope): boolean =>
  at === "collection" ? c.collection === true : !c.collection;

export const otherScope = (at: CommandScope): CommandScope =>
  at === "record" ? "collection" : "record";

/** commandScope is the address a route holds: with a row in the path, a record's. */
export const commandScope = (id: string | undefined): CommandScope =>
  id ? "record" : "collection";

/** commandOf finds the command a route's verb names at the address it was opened at. */
export const commandOf = (e: Entry, verb: string, at: CommandScope): Command | undefined =>
  e.commands.find((c) => c.verb === verb && commandAt(c, at));

/**
 * verbRefusal is what a screen says when it is asked to send a verb the
 * resource does not mount. The door for such a verb is never drawn, so this is
 * the sentence for a sheet reached by a link or a stale notification rather
 * than for a choice somebody was offered — and the request itself is refused
 * before it is built, because the address it would go to is not there.
 */
export const verbRefusal = (verb: CrudVerb): string =>
  verb === "create"
    ? "This record cannot be created here."
    : verb === "update"
      ? "This record cannot be edited here."
      : verb === "delete"
        ? "This record cannot be deleted here."
        : "This is not available here.";

/**
 * commandPath is where a command is POSTed. The kernel prints an address only
 * when {entry.path}/{id}/{verb} — or {entry.path}/{verb} for a command about
 * the collection — is no longer where it mounted the verb, so a printed path is
 * the whole endpoint and already ends in the verb: it is used as it is read,
 * with the row substituted and the verb never appended again.
 */
export const commandPath = (e: Entry, verb: string, id?: string): string => {
  const printed = e.commands.find((c) => c.verb === verb)?.path;
  if (printed === undefined) {
    const at = id ? `${e.path}/${encodeURIComponent(id)}` : e.path;
    return `${at}/${encodeURIComponent(verb)}`;
  }
  if (!printed.includes(rowPlaceholder)) return printed;
  if (id === undefined) {
    throw new TypeError(`command "${verb}" is answered at ${printed}, which needs the row`);
  }
  return printed.split(rowPlaceholder).join(encodeURIComponent(id));
};
