// React keeps one stack of act() scopes for the whole file, and it unwinds a
// scope only in the `then` of the thenable act() hands back. A test that fires
// an event without awaiting it — which @testing-library's fireEvent invites,
// since fireEvent is an async act() call — therefore has its next three events
// open three scopes before the first one closes. Their unwinding then happens in
// the wrong order: React restores a depth of two where it should have restored
// zero, says so itself ("You seem to have overlapping act() calls, this is not
// supported"), and leaves the queue that holds commits open for the rest of the
// file. The next test renders, commits go into a scope nobody closes, and it
// fails on "no element with testID email" — an empty tree, a thousand
// milliseconds away from the defect it looks like.
//
// This wrapper carries out what that warning says instead of emitting it: an act
// never opens while an earlier one is still open. An act asked for while no
// scope is open runs in the same tick exactly as React's own, so a test that
// presses a control and then looks at what the press did cannot tell the
// difference; only an act that would overlap one still open waits for it, and is
// awaited by the queue even when the test does not await it, so React pops
// scopes in the order it pushed them. An act that a running act's own
// continuation asks for is a nested one and joins the open scope — waiting for
// the scope that is waiting for it would deadlock — which is what the
// async-context check below tells apart from a sibling fired from the test's own
// frame. Nothing is skipped, nothing is queued twice, and no assertion is moved.
import { AsyncLocalStorage } from "node:async_hooks";
import React from "react";

type Act = (callback: () => unknown) => Promise<unknown>;
interface ActGlobals {
  IS_REACT_ACT_ENVIRONMENT?: unknown;
}

const reactAct = React.act as unknown as Act;
/** inside marks the async chain of an act React holds: anything that asks for an
 * act from inside that chain belongs to the scope already open. */
const inside = new AsyncLocalStorage<boolean>();
/** open counts the acts this wrapper handed to React that have not settled. */
let open = 0;
/** kept is what the act environment held before the outermost open act.
 * @testing-library sets that flag for the call it is making and restores it when
 * the call settles — which, for an act still waiting its turn, is before it
 * runs, and React then calls an update that is wrapped "not configured to
 * support act(...)". The flag belongs to the scope, so it is held for the scope. */
let kept: unknown;
const waiting: (() => void)[] = [];

function begin(callback: () => unknown): Promise<unknown> {
  const globals = globalThis as unknown as ActGlobals;
  if (open === 0) kept = globals.IS_REACT_ACT_ENVIRONMENT;
  open++;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  return new Promise((resolve, reject) => {
    const close = (settle: (value: unknown) => void) => (value: unknown) => {
      open--;
      if (open === 0) globals.IS_REACT_ACT_ENVIRONMENT = kept;
      settle(value);
      // Whoever queued behind this scope may go now, one at a time: each one
      // closes before the next is let in, which is the whole point.
      while (open === 0 && waiting.length > 0) waiting.shift()?.();
    };
    inside.run(true, () => reactAct(callback)).then(close(resolve), close(reject));
  });
}

(React as unknown as { act: Act }).act = (callback: () => unknown) => {
  if (inside.getStore() || open === 0) return begin(callback);
  return new Promise((resolve, reject) => {
    waiting.push(() => {
      begin(callback).then(resolve, reject);
    });
  });
};
