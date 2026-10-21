import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Entry } from "../core/catalog";
import { deckEvent, deckWindow, startDeck, type DeckInput, type DeckState } from "../core/deck";
import type { Deck } from "../core/catalogDeck";
import { boundArguments } from "../core/bindings";
import {
  commandWording,
  commandConfirmation,
  deckAcceptedRow,
  deckCommand,
  deckHeldWrite,
  failureSubject,
  type Copy,
  type Row,
} from "../core/derive";
import { type PendingWrite } from "../core/outbox";
import { PER_PAGE } from "../effects/api";
import { useShell } from "../shell";
import { confirm } from "../ui/chooser";
import { useTheme } from "../ui/theme";
import { refusalOf } from "./failure";
import { useCommandOutcome } from "./useCommand";

/**
 * DeckReceipt is what the owner of a deck's screen knows about its commands and the pass cannot:
 * which answer counts as the card having been decided, and what the card row itself supplies as
 * an argument. Both default to what a queue whose command returns its own row needs.
 */
export interface DeckReceipt {
  /** accepted says the row the command answered is the answer to this card's intent. */
  readonly accepted?: (id: string, row: Row) => boolean;
  /** onAccepted tells the screen's owner that one card's command was taken, so it can ask again about what that changed. */
  readonly onAccepted?: (id: string) => void;
}

/** useResourceDeck owns one bounded pass, its live reads and its single command intent. */
export function useResourceDeck(
  entry: Entry,
  deck: Deck,
  copy: Copy,
  animated: boolean,
  receipt?: DeckReceipt,
) {
  const { api, outbox } = useShell();
  const { mode } = useTheme();
  const send = useCommandOutcome(entry);
  const [state, setState] = useState(() => startDeck(deck));
  const current = useRef(state);
  const alive = useRef(true);
  const held = useRef<readonly PendingWrite[]>([]);
  const submitted = useRef(new Set<number>());
  const asked = useRef(new Set<number>());
  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const publish = useCallback((next: DeckState) => {
    if (!alive.current) return;
    current.current = next;
    setState(next);
  }, []);
  const event = useCallback(
    (input: DeckInput) => {
      if (!alive.current) return;
      publish(deckEvent(current.current, { ...input, session: current.current.session }));
    },
    [publish],
  );
  const existing = useCallback(
    (next: DeckState, items: readonly PendingWrite[]) => {
      const id = next.active[0];
      if (!id || next.phase !== "ready") return next;
      const first = deckHeldWrite(entry, id, items);
      return first
        ? deckEvent(next, {
            type: "existing",
            session: next.session,
            heldID: first.id,
            unknown: first.state === "unknown",
            text:
              first.state === "unknown"
                ? copy.failure.uncertain
                : copy.state.holding(copy.state.held.title),
          })
        : next;
    },
    [entry, copy],
  );

  const heldItems = outbox?.items;
  useLayoutEffect(() => {
    held.current = heldItems ?? [];
  }, [heldItems]);
  useEffect(() => {
    const items = heldItems ?? [];
    const now = current.current;
    if (now.phase === "ready") publish(existing(now, items));
    else if (["held", "unknown"].includes(now.phase) && now.pending?.heldID) {
      const item = items.find((i) => i.id === now.pending?.heldID);
      if (!item) {
        event({ type: "close" });
        return;
      }
      const text =
        item.state === "unknown"
          ? copy.failure.uncertain
          : item.state === "refused"
            ? copy.state.refused.body
            : copy.state.holding(copy.state.held.title);
      publish({ ...now, phase: item.state === "unknown" ? "unknown" : now.phase, notice: text });
    }
  }, [heldItems, existing, publish, event, copy]);

  useEffect(() => {
    if (state.phase !== "loading" && state.phase !== "checking") return;
    let live = true;
    const started = current.current;
    void (async () => {
      try {
        if (started.phase === "checking") {
          const page = await api.list(entry, {
            offset: 0,
            limit: 1,
            sort: deck.order,
            filters: deck.queue,
          });
          if (live && current.current.operation === started.operation)
            event({ type: "count", operation: started.operation, total: page.total });
          return;
        }
        let next = started;
        while (next.phase === "loading") {
          const window = deckWindow(next, PER_PAGE);
          const page = await api.list(entry, window);
          if (!live || !alive.current || current.current.operation !== started.operation) return;
          next = deckEvent(next, {
            type: "page",
            session: next.session,
            operation: next.operation,
            offset: window.offset,
            ...page,
          });
        }
        if (live && alive.current && current.current.operation === started.operation)
          publish(existing(next, held.current));
      } catch (error) {
        if (!live || !alive.current || current.current.operation !== started.operation) return;
        const refusal = refusalOf(error, "read", failureSubject(entry), copy);
        const retryable =
          refusal.verdict.outcome === "notice" && refusal.verdict.action === "retry";
        const withdraw =
          refusal.verdict.kind === "access" ||
          refusal.verdict.kind === "missing" ||
          refusal.verdict.kind === "signed-out" ||
          refusal.verdict.kind === "plan";
        event({
          type: "read-failed",
          operation: started.operation,
          retryable,
          withdraw,
          text:
            started.phase === "checking" && !withdraw
              ? copy.review.checkFailed
              : refusal.text || copy.failure.loadFailed(entry.entity),
        });
      }
    })();
    return () => {
      live = false;
    };
  }, [state.phase, state.operation, api, entry, deck, copy, event, publish, existing]);

  useEffect(() => {
    if (state.phase !== "confirming" || !state.pending || asked.current.has(state.operation))
      return;
    asked.current.add(state.operation);
    const c = deckCommand(entry, state.pending.direction);
    if (!c) {
      event({ type: "cancel", operation: state.operation });
      return;
    }
    const words = commandWording(c, "", copy);
    const operation = state.operation;
    confirm(
      words.title,
      {
        label: words.button,
        destructive: c.hints?.destructive === true,
        onPress: () => event({ type: "confirm", operation }),
      },
      mode,
      {
        message: words.consequence,
        cancel: copy.choice.cancel,
        onCancel: () => event({ type: "cancel", operation }),
      },
    );
  }, [state.phase, state.pending, state.operation, entry, copy, event, mode]);

  useEffect(() => {
    if (state.phase !== "submitting" || !state.pending || submitted.current.has(state.operation))
      return;
    const { id, direction, operation } = state.pending;
    const c = deckCommand(entry, direction);
    if (!c) return;
    submitted.current.add(operation);
    // An argument the entry declares as bound is filled from the card the person is deciding —
    // the same value a server-side screen takes from the row it drew the button beside.
    const body = boundArguments(c, state.rows[id]);
    if (c.bindings !== undefined && body === undefined) {
      // The card row holds no value this command was declared to take from it, so nothing can be
      // said about what this direction would do. It is refused where it stands, unsent.
      event({ type: "refused", operation, text: copy.review.unavailable, missing: false });
      return;
    }
    void send(c, id, {
      accept: (row) => (receipt?.accepted ?? deckAcceptedRow)(id, row),
      current: () => alive.current,
      ...(body === undefined ? {} : { body }),
    }).then((answer) => {
      if (!alive.current || current.current.operation !== operation) return;
      switch (answer.kind) {
        case "accepted":
          event({ type: "accepted", operation });
          receipt?.onAccepted?.(id);
          break;
        case "held":
          event({
            type: answer.item.state === "unknown" ? "unknown" : "held",
            operation,
            heldID: answer.item.id,
            text:
              answer.item.state === "unknown"
                ? copy.failure.uncertain
                : copy.state.holding(copy.state.held.title),
          });
          break;
        case "unknown":
          event({ type: "unknown", operation, text: answer.text });
          break;
        case "refused":
          event({ type: "refused", operation, text: answer.text, missing: answer.status === 404 });
          break;
      }
    });
  }, [state.phase, state.pending, state.operation, entry, copy, send, event, receipt]);

  const settled = useCallback(
    () => event({ type: "settled", operation: state.operation }),
    [event, state.operation],
  );
  const finishEnd = useCallback(
    () => event({ type: "finish-end", operation: state.operation }),
    [event, state.operation],
  );
  useEffect(() => {
    if (!animated && state.phase === "settling") settled();
  }, [animated, state.phase, settled]);
  useFocusEffect(
    useCallback(() => {
      if (current.current.phase === "suspended") event({ type: "resume" });
    }, [event]),
  );
  const choose = useCallback(
    (direction: string) => {
      const now = existing(current.current, held.current);
      if (now !== current.current) {
        publish(now);
        return;
      }
      const c = deckCommand(entry, direction);
      event({
        type: "choose",
        direction,
        confirmation: c ? commandConfirmation(c, copy).required : false,
      });
    },
    [entry, copy, existing, publish, event],
  );
  const action = useCallback(
    (name: string, operation?: number) => {
      if (operation !== undefined && current.current.operation !== operation) return;
      if (name === "rewind") event({ type: "rewind" });
      else choose(name);
    },
    [choose, event],
  );
  return {
    state,
    action,
    settled,
    finishEnd,
    refresh: useCallback(() => event({ type: "refresh" }), [event]),
    retry: useCallback(() => event({ type: "retry" }), [event]),
    suspend: useCallback(() => event({ type: "suspend" }), [event]),
  };
}
