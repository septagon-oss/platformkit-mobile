// useSaveToggle is where a person's copy of a record becomes a prop: it asks the server
// whether this person already keeps the record on screen, and turns the press of the heart
// into the write the catalogue addresses.
//
// Two rules hold it together. Nothing is drawn before the answer arrives — `unknown` is not
// "not kept", and a heart that says a copy is absent when nobody has said so is a control
// that lies about the person's own things. And nothing is optimistic: the pressed state
// follows the server's answer, the removal quotes the revision the row arrived with, and a
// refusal leaves the control exactly where it was, because a save that did not happen is
// not a save that is pending.
//
// The press runs one at a time per record, the rule a row's swipe keeps for the same
// reason: two records are not "the button is running", and one record pressed twice while
// its write is out was pressed once.
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { key, type Entry } from "../core/catalog";
import { failureSubject } from "../core/derive";
import { expectedSourceVersion, savable, sourceRef } from "../core/saved";
import type { KeptAnswer } from "../effects/saved";
import type { Row } from "../core/derive";
import type { SaveButtonModel } from "../ui/molecules/SaveButton";
import { useShell } from "../shell";
import { notice, refusalOf, screenCopy } from "./failure";

/** Keeping is this screen's holding of the answer, the press and the one sentence under the control. */
interface Keeping {
  readonly answer: KeptAnswer;
  readonly pending: boolean;
  readonly note: string;
}

export interface SaveToggle {
  /**
   * model is the control's whole state, or nothing when no control may be drawn: this build
   * composes no saved port, this entry declares nothing about being saved, or nobody has
   * answered whether a copy is kept. Absence is drawn as absence and never as an inert
   * control.
   */
  readonly model: SaveButtonModel | undefined;
  readonly press: () => void;
}

/**
 * useSaveToggle asks and answers for one record on screen.
 *
 * `row` is the row the screen drew, and the version it quotes is read out of it, so a keep
 * cannot quote a version this phone never saw. The ask runs on mount and on every focus,
 * which is how a copy kept on another phone reaches this one.
 */
export function useSaveToggle(
  entry: Entry,
  id: string | undefined,
  row: Row | undefined,
): SaveToggle {
  const { saved, state, wrote } = useShell();
  const copy = screenCopy();
  const pair = useMemo(
    () => (state.catalog === undefined ? undefined : savable(entry, state.catalog.resources)),
    [entry, state.catalog],
  );
  const [keeping, setKeeping] = useState<Keeping>({
    answer: { state: "unknown" },
    pending: false,
    note: "",
  });
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const ask = useCallback(async () => {
    if (!saved || !pair || !id) return;
    const answer = await saved.probe(pair, sourceRef(entry, id));
    if (alive.current) setKeeping((was) => ({ ...was, answer }));
  }, [saved, pair, entry, id]);
  useEffect(() => {
    void (async () => {
      await ask();
    })();
  }, [ask]);
  // Coming back to the record asks again: a copy this person kept elsewhere is theirs here.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await ask();
      })();
    }, [ask]),
  );

  const press = useCallback(async () => {
    if (!saved || !pair || !id || running.current) return;
    running.current = true;
    setKeeping((was) => ({ ...was, pending: true, note: "" }));
    try {
      if (keeping.answer.state === "kept") {
        await saved.remove(pair, keeping.answer.id, keeping.answer.revision);
      } else {
        const written = await saved.keep(
          pair,
          sourceRef(entry, id),
          row === undefined ? "" : expectedSourceVersion(row),
        );
        if (!written.kept) {
          // The server never took it: the control stays unpressed and says where the write
          // is, in the queue's own words, exactly as a held command does.
          if (alive.current)
            setKeeping((was) => ({
              ...was,
              note: copy.state.holding(copy.state.held.title),
            }));
          return;
        }
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      // The list of copies is the screen that shows what this wrote, so it is told to look
      // again; the heart itself waits for the answer rather than drawing the press.
      wrote(key(pair.list));
      await ask();
    } catch (e) {
      if (alive.current) {
        const said = refusalOf(
          e,
          keeping.answer.state === "kept" ? "delete" : "command",
          failureSubject(pair.source, pair.words.save),
          copy,
        );
        setKeeping((was) => ({ ...was, note: notice(said.verdict) }));
      }
      return;
    } finally {
      running.current = false;
      if (alive.current) setKeeping((was) => ({ ...was, pending: false }));
    }
  }, [saved, pair, id, entry, row, keeping.answer, ask, copy, wrote]);

  const kept = keeping.answer.state === "kept";
  const model: SaveButtonModel | undefined =
    saved === undefined ||
    pair === undefined ||
    id === undefined ||
    keeping.answer.state === "unknown"
      ? undefined
      : {
          label: kept ? pair.words.saved : pair.words.save,
          kept,
          busy: keeping.pending,
          disabled: keeping.pending,
          ...(keeping.note === "" ? {} : { note: keeping.note }),
          testID: kept ? "saved-heart-pressed" : "saved-heart",
        };
  return { model, press: () => void press() };
}
