// The two reads every outfit screen shares. The module's suggestions and looks are its own JSON
// projections rather than catalogue rows, so each is asked through the transport's one validator
// door: a body outside the shape in ./wire is refused there, never drawn as a card with a missing
// member.
//
// The window is the only state either read keeps, and the answer owns it: `skip` is taken from the
// body that arrived, never counted by this phone, so a window the person moved past cannot be
// overwritten by a page that was slow to get back.
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Entry } from "../../core/catalog";
import type { MediaItem } from "../../core/media";
import { noun } from "../../core/present";
import { pictureState, type PictureStates } from "../../core/pictures";
import { refusalOf } from "../../screens/failure";
import type { Feedback } from "../../core/present";
import { useFeedback } from "../../screens/useFeedback";
import { useShell } from "../../shell";
import { extent } from "../../ui/scale";
import { lookWire, suggestionWire, type LookWire, type SuggestionWire } from "./wire";

/** OutfitAsk is the whole of what one read of the wall sends: where its window starts. */
export interface OutfitAsk {
  readonly skip: number;
}

/**
 * OutfitPorts is all a composition may change about these reads: where the two live. The module
 * mounts no route of its own, so the address is the installation's and a kit that guessed one would
 * be holding a fact about somebody's server.
 */
export interface OutfitPorts {
  /** suggest is the collection read for one window; the default puts `skip` in the query only when the window does not start at 0. */
  readonly suggest?: (entry: Entry, ask: OutfitAsk) => string;
  /** look is one look by its key; the default asks for the key as one encoded path segment. */
  readonly look?: (entry: Entry, key: string) => string;
}

/** noPorts is the kit's own spelling of both doors, and one value so a screen's reads stay stable. */
export const noPorts: OutfitPorts = Object.freeze({});

const suggested = (entry: Entry, ask: OutfitAsk): string =>
  ask.skip > 0 ? `${entry.path}?skip=${ask.skip}` : entry.path;

const lookedUp = (entry: Entry, key: string): string => `${entry.path}/${encodeURIComponent(key)}`;

const suggestPath = (ports: OutfitPorts, entry: Entry, skip: number): string =>
  (ports.suggest ?? suggested)(entry, { skip });

const lookPath = (ports: OutfitPorts, entry: Entry, key: string): string =>
  (ports.look ?? lookedUp)(entry, key);

/** Window is one ask of the wall: where it starts, and whether its looks join those on screen. */
interface Window {
  readonly skip: number;
  readonly append: boolean;
  /** seq says which ask this is; 0 is the one that was never asked. */
  readonly seq: number;
}

const neverAsked: Window = { skip: 0, append: false, seq: 0 };

/** byLine keeps one look per key: a vocabulary that moved between two asks cannot give the wall two cells. */
const byLine = (looks: readonly LookWire[]): readonly LookWire[] => {
  const seen = new Set<string>();
  const once: LookWire[] = [];
  for (const look of looks) {
    if (seen.has(look.ref.key)) continue;
    seen.add(look.ref.key);
    once.push(look);
  }
  return once;
};

/** How a read that refused is put in words: the server's own sentence, in the reader's language. */
function refusalText(failure: unknown, entry: Entry, feedback: Feedback): string {
  const named = noun(entry);
  return refusalOf(
    failure,
    "read",
    { singular: named.singular, plural: named.plural, command: "", lastSeen: "" },
    feedback.copy,
  ).text;
}

export interface LooksRead {
  readonly looks: readonly LookWire[];
  /** answer is the window as the module answered it: its answers, its position and whether it is the last. */
  readonly answer: SuggestionWire | undefined;
  readonly error: string;
  readonly asking: boolean;
  /** more is whether a further window is owed. The module said so, or it did not. */
  readonly more: boolean;
  /** next asks for the window one step on — appended to what is on screen, or replacing it. */
  readonly next: (mode: "append" | "replace") => void;
  readonly retry: () => void;
}

/**
 * useOutfitLooks reads the wall one window at a time.
 *
 * It asks when the screen arrives and then only when the person asks it to. One read is in flight at
 * a time: a press while one is out changes nothing, and a refusal keeps the window already on screen
 * and says what refused. The step to the next window is the length of the window just answered, so
 * the phone never asserts how many looks the module pages out.
 */
export function useOutfitLooks(entry: Entry, ports: OutfitPorts = noPorts): LooksRead {
  const { api } = useShell();
  const feedback = useFeedback();
  // The words are read when a failure is named, not when the request is made. Feedback is new every
  // render, so an effect keyed by it would ask again every render; it is held beside the read in a
  // ref written by an effect.
  const said = useRef(feedback);
  useEffect(() => {
    said.current = feedback;
  }, [feedback]);
  const [looks, setLooks] = useState<readonly LookWire[]>([]);
  const [answer, setAnswer] = useState<SuggestionWire | undefined>();
  const [pending, setPending] = useState<Window>(neverAsked);
  // Which ask the screen has heard of, and what it said. A read is in flight while the ask on screen
  // is one the phone has not heard of yet, so nothing has to be set going *into* a request.
  const [heard, setHeard] = useState<{ seq: number; error: string }>({ seq: 0, error: "" });
  const asking = pending.seq > heard.seq;
  const path = suggestPath(ports, entry, pending.skip);
  useEffect(() => {
    if (pending.seq === 0) return;
    let live = true;
    const settled = (error: string) => {
      if (live) setHeard({ seq: pending.seq, error });
    };
    void api
      .request("GET", path, (body: unknown) => suggestionWire.parse(body))
      .then((body) => {
        if (!live) return;
        setAnswer(body);
        setLooks((was) => byLine(pending.append ? [...was, ...body.looks] : body.looks));
        settled("");
      })
      .catch((failure: unknown) => {
        // The window already drawn stays drawn: a page that refused is a page that said no, not a
        // page that came back empty.
        settled(refusalText(failure, entry, said.current));
      });
    return () => {
      live = false;
    };
  }, [api, entry, path, pending]);
  useFocusEffect(
    useCallback(() => {
      // The wall asks once, when it is first shown. The ranking is what it is, and coming back to a
      // window that is already on screen asks for it again for nobody.
      setPending((was) => (was.seq === 0 ? { ...was, seq: 1 } : was));
    }, []),
  );
  const next = useCallback(
    (mode: "append" | "replace") => {
      if (asking || answer === undefined || (mode === "append" && answer.ended)) return;
      setPending((was) => ({
        skip: answer.skip + answer.looks.length,
        append: mode === "append",
        seq: was.seq + 1,
      }));
    },
    [asking, answer],
  );
  // Retry asks the same window again — the same position and the same mode — because that is the
  // ask that refused, and the cards already on screen are not the person's problem.
  const retry = useCallback(() => setPending((was) => ({ ...was, seq: was.seq + 1 })), []);
  return {
    looks,
    answer,
    error: heard.error,
    asking,
    more: answer === undefined ? false : !answer.ended,
    next,
    retry,
  };
}

export interface LookRead {
  readonly look: LookWire | undefined;
  readonly error: string;
  readonly asking: boolean;
  readonly retry: () => void;
}

/**
 * useOutfitLook reads one look by the key it is kept under, asking on focus so a look redrawn after
 * a recolouring arrives as the record it is now. A refusal keeps the look already on screen and says
 * what refused; the key is not second-guessed here, because the vocabulary behind it is the
 * module's and a phone that refused to ask would be deciding what a source is on its own.
 */
export function useOutfitLook(ports: OutfitPorts, entry: Entry, key: string): LookRead {
  const { api } = useShell();
  const feedback = useFeedback();
  const said = useRef(feedback);
  useEffect(() => {
    said.current = feedback;
  }, [feedback]);
  const [look, setLook] = useState<LookWire | undefined>();
  const [asked, setAsked] = useState(0);
  // Which ask arrived, and what it said. A read is in flight while the ask the screen holds has not
  // answered for itself.
  const [heard, setHeard] = useState<{ seq: number; error: string }>({ seq: -1, error: "" });
  const retry = useCallback(() => setAsked((was) => was + 1), []);
  const path = lookPath(ports, entry, key);
  useEffect(() => {
    let live = true;
    const settled = (error: string) => {
      if (live) setHeard({ seq: asked, error });
    };
    void api
      .request("GET", path, (body: unknown) => lookWire.parse(body))
      .then((body) => {
        if (!live) return;
        setLook(body);
        settled("");
      })
      .catch((failure: unknown) => {
        // The look already on screen stays on screen with the sentence that refused the new copy.
        settled(refusalText(failure, entry, said.current));
      });
    return () => {
      live = false;
    };
  }, [api, entry, path, asked]);
  useFocusEffect(
    useCallback(() => {
      setAsked((was) => was + 1);
    }, []),
  );
  return { look, error: heard.error, asking: asked > heard.seq, retry };
}

/**
 * captionOf puts the module's own words in one line, in the order it gave them, and adds nothing:
 * no separator translated, no word capitalised, nothing sorted.
 */
export const captionOf = (words: readonly string[]): string =>
  words.filter((word) => word.trim() !== "").join(" · ");

/** answersCaption is what the person answered with, printed as the module printed it. */
export const answersCaption = (
  answer: { readonly season: string; readonly style: string } | undefined,
): string => (answer === undefined ? "" : captionOf([answer.season, answer.style]));

/**
 * lookItem is one look as a surface draws it: the look's name spoken as its picture's name, and the
 * frame the flat-lay is authored in.
 *
 * `line` is the caption under the frame — a card carries the module's own pieces line, a look page
 * that lists every piece does not. With no picture door composed there is nothing to ask and nothing
 * to wait for, so the frame says the picture is unavailable rather than showing a skeleton that
 * would never fill.
 */
export const lookItem = (
  look: LookWire,
  door: boolean,
  states: PictureStates,
  line?: string,
): MediaItem => ({
  id: look.picture,
  width: extent.flatlay,
  height: extent.flatlayHeight,
  description: look.name,
  ...(line === undefined ? {} : { caption: line }),
  decorative: false,
  state: door ? pictureState(look.picture, look.picture, states) : "unavailable",
});
