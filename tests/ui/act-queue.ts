// React keeps one stack of act() scopes for the whole file and unwinds a scope
// only when something subscribes to the thenable act() hands back. Two scopes
// open at once therefore unwind in the wrong order and leave the stack
// permanently one deeper, and from then on every commit is queued into a scope
// that never closes: the next test renders an empty tree and fails on something
// a previous test typed. @testing-library's fireEvent is an async act() call, so
// a test that fires an event without awaiting it — or that starts the next thing
// while one is still closing — opens two at once. React says so itself: "You
// seem to have overlapping act() calls, this is not supported."
//
// This wrapper carries out that instruction instead of warning about it. An act
// whose predecessors have all closed runs exactly as React's own does, in the
// same tick; one that would overlap waits for the scope before it. The callback
// is the same and the value it resolves with is the same, so a test that awaits
// its event cannot tell the difference — only a test that does not await one
// stops costing it the tests that come after. Nothing here is skipped.
import React from "react";

type Act = (callback: () => unknown) => Promise<unknown>;

const reactAct = React.act as unknown as Act;

/** open is how many scopes this wrapper has handed out and React has not closed. */
let open = 0;
/** inside counts the acts opened from within a running callback: they belong to
 * the scope that is already open, so they join the queue for nothing. */
let inside = 0;
const waiting: (() => void)[] = [];

function openOne(callback: () => unknown): Promise<unknown> {
  open++;
  return new Promise((resolve, reject) => {
    inside++;
    let settled = false;
    const close = (settle: (value: unknown) => void) => (value: unknown) => {
      if (settled) return;
      settled = true;
      inside--;
      open--;
      settle(value);
      // Whoever queued behind this scope may go now, one at a time: each one
      // closes before the next is let in, which is the whole point.
      while (open === 0 && waiting.length > 0) waiting.shift()?.();
    };
    reactAct(callback).then(close(resolve) as never, close(reject) as never);
  });
}

(React as unknown as { act: Act }).act = (callback: () => unknown) => {
  if (inside > 0 || open === 0) return openOne(callback);
  return new Promise((resolve, reject) => {
    waiting.push(() => {
      openOne(callback).then(resolve, reject);
    });
  });
};
