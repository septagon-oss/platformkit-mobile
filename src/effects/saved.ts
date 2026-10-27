// The saved port: one person's copies, as this phone can act on them.
//
// The server owns the list. This file holds no rows, no table and no cache of its own:
// `probe` asks, `keep` asks the server to retain, and `remove` asks it to stop. A device
// keeping its own list would answer differently from the web for the same person, and the
// availability of a copy's source is a live observation the phone cannot make from memory,
// so a stored copy of the list would be a second implementation of a rule the saved
// service owns (decisions 0093/0094).
//
// A keep travels through the queue this phone already has, so a save made on a train lands
// when the train comes out of the tunnel. A removal never travels that way: the service
// answers it with no body, which the queue's replay cannot tell from a write whose fate is
// unknowable, and a queue that lies about the one thing it exists to be honest about is
// worse than a removal that waits for a connection. So a removal is never put on the queue:
// it goes live, and where there is no connection the transport refuses it and this phone
// writes nothing at all.
import { key } from "../core/catalog";
import { commandPath } from "../core/command";
import { saveBody, savedRef, unsaveBody, type Savable, type SavedRef } from "../core/saved";
import type { NewWrite } from "../core/outbox";
import type { Api } from "./api";
import type { Outbox } from "./outbox";

/** SavedWrite is what a keep leaves this phone knowing: kept, or held here for want of a network. */
export interface SavedWrite {
  readonly kept: boolean;
  readonly held: boolean;
}

/**
 * KeptAnswer is what one probe answers about one source record: nobody has said yet, this
 * person keeps no copy, or this person keeps this one — by its id and the revision it came
 * with, which is the only answer a removal may quote.
 *
 * `unknown` is a state and not a failure: a control drawn before the answer arrives would
 * show a person a heart that says their own copy is not there.
 */
export type KeptAnswer =
  | { readonly state: "unknown" }
  | { readonly state: "absent" }
  | { readonly state: "kept"; readonly id: string; readonly revision: number };

const nothingSaid: KeptAnswer = { state: "unknown" };
const nothingKept: KeptAnswer = { state: "absent" };

/**
 * answeredCopy reads the one fact out of a find answer and nothing else: whether a copy is
 * there, and the two numbers a removal has to quote. A body that is neither nothing nor a
 * row with an id and a revision says nothing about this person's copies, so it answers
 * `unknown` — the kit reads no snapshot, no title and no availability off a find read.
 */
function answeredCopy(value: unknown): KeptAnswer {
  if (value === undefined || value === null) return nothingKept;
  if (typeof value !== "object") return nothingSaid;
  const row = value as Readonly<Record<string, unknown>>;
  const id = row.id;
  const revision = row.revision;
  if (typeof id !== "string" || id === "") return nothingSaid;
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)
    return nothingSaid;
  return { state: "kept", id, revision };
}

/**
 * SavedPort is the saved surface as a screen acts on it. Nothing here answers a person's
 * list of copies — that is an ordinary paged read of the saved entry, drawn by the same
 * list every other resource draws — and nothing here caches what it asks.
 */
export interface SavedPort {
  /**
   * probe answers whether this person keeps one source record. A refusal, a body that
   * names no copy and a read that has not been asked all answer `unknown`.
   */
  readonly probe: (pair: Savable, ref: SavedRef) => Promise<KeptAnswer>;
  /** keep asks the server to retain one record, and says whether it did or this phone is holding the ask. */
  readonly keep: (pair: Savable, ref: SavedRef, version: string) => Promise<SavedWrite>;
  /** remove takes one copy away, quoting the revision it arrived with. A refusal is thrown; nothing is held. */
  readonly remove: (pair: Savable, id: string, revision: number) => Promise<void>;
}

/**
 * SavedFinder is the composition's own read of one source record: it answers that person's
 * copy, or nothing when they keep none. The address is the composition's because which shape
 * the server publishes is the kernel's decision, and a read that says "no such row" with a
 * refusal is the adapter's to translate into silence.
 */
export type SavedFinder = (ref: SavedRef) => Promise<unknown>;

/**
 * SavedDeps is what one port needs: the transport, this phone's queue, and the composition's
 * own read of whether a copy exists. It names no entry and no address, because the pair each
 * call speaks to arrives with the call: one port serves every savable entry the mounted
 * catalogue prints, and the composition line is one object at the app root.
 */
export interface SavedDeps {
  readonly request: Api["request"];
  /** outbox is this phone's queue, or nothing on a host that ships no store. */
  readonly outbox: Outbox | undefined;
  /**
   * find asks whether this person already keeps one source record and answers its copy, or
   * nothing when they keep none. The composition owns the address, because which shape the
   * server publishes — a find read of its own, or the answer carried on the source's own
   * read — is the kernel's decision and not this kit's, and because a read that cannot name
   * a copy as "none" (a 404, say) is the adapter's to translate. The kit owns only what an
   * answer *means*: a row with an id and a revision says kept, nothing says not kept, and
   * anything else says nobody has said.
   */
  readonly find: SavedFinder;
}

/** keptAnswer is what a keep answers with: the copy the server now holds. */
function keptAnswer(value: unknown): unknown {
  // The fact this kit needs is that the server kept the copy, which its 2xx already said;
  // the copy itself is read off the saved list, not off this answer. A body that is not a
  // record at all is a contract this build does not read, so it is refused as one.
  if (value === null || typeof value !== "object")
    throw new TypeError("keep: the server answered without the copy it kept");
  return value;
}

/**
 * createSaved composes one port for one savable pair.
 *
 * A keep is validated on the way out and never on the way back in: the two arguments are
 * the phone's to supply and nobody types them, so a body the service would not read is
 * refused here rather than POSTed. A keep that the network never took joins the queue
 * behind whatever this phone already holds to the same resource, and answers `held` — the
 * honest answer a network that will not take the request gets. A removal goes live or not
 * at all.
 */
export function createSaved(deps: SavedDeps): SavedPort {
  const { request, outbox } = deps;
  const saveAt = (pair: Savable): string => commandPath(pair.list, pair.saveVerb);
  const unsaveAt = (pair: Savable, id: string): string =>
    commandPath(pair.list, pair.unsaveVerb, id);
  return {
    async probe(pair, ref) {
      let answer: unknown;
      try {
        answer = await deps.find(savedRef.parse(ref));
      } catch {
        // Nothing answered, or what answered refused: in both cases this phone does not
        // know, and a screen that does not know draws no heart.
        return nothingSaid;
      }
      return answeredCopy(answer);
    },
    async keep(pair, ref, version) {
      const body = saveBody.parse({
        source: savedRef.parse(ref),
        expectedSourceVersion: version,
      });
      const live = (idem?: string) =>
        request(
          "POST",
          saveAt(pair),
          keptAnswer,
          body,
          idem === undefined ? undefined : { idempotencyKey: idem },
        );
      if (!outbox) {
        await live();
        return { kept: true, held: false };
      }
      const write: NewWrite = {
        kind: "command",
        resourceKey: key(pair.list),
        path: saveAt(pair),
        body,
      };
      const answer = await outbox.submit(write, (idem) => live(idem));
      return answer.sent
        ? { kept: true, held: false }
        : // The queue kept it: it may still be held back by an older write to this same
          // resource, which is the case `submit` documents, and the screen says so.
          { kept: false, held: true };
    },
    async remove(pair, id, revision) {
      const body = unsaveBody.parse({ id, expectedRevision: revision });
      await request("POST", unsaveAt(pair, id), (value) => value, body);
    },
  };
}
