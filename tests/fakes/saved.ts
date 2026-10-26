// The saved port as a test sees it: scripted answers per call, and the record of every call a
// screen made. A screen test that asks whether a heart presses itself, holds a write or waits
// for the answer asks this fake, which answers nothing it was not told to — a probe nobody
// scripted has said nothing, which is the state a control stays undrawn in. The real port
// (`src/effects/saved.ts`) is answered by a real transport and a real queue in
// tests/saved-write-goes-when-the-network-comes-back.test.ts; this file is for the screens on
// the other side of that seam, and the pair each call carries is recorded so a test can read
// the address the screen resolved without importing the derivation itself.
import { jest } from "@jest/globals";
import type { Savable, SavedRef } from "../../src/core/saved";
import type { KeptAnswer, SavedPort, SavedWrite } from "../../src/effects/saved";

/** Script is what the fake answers: each list is read in order and its last value repeats. */
export interface Script {
  readonly probes?: readonly KeptAnswer[];
  readonly writes?: readonly (SavedWrite | Error)[];
  readonly removals?: readonly (undefined | Error)[];
}

/** Asked is one recorded call: the pair it speaks to, and the arguments beside it. */
export type Asked = { readonly pair: Savable } & (
  | { readonly verb: "probe"; readonly ref: SavedRef }
  | { readonly verb: "keep"; readonly ref: SavedRef; readonly version: string }
  | { readonly verb: "remove"; readonly id: string; readonly revision: number }
);

/**
 * fakeSaved is a `SavedPort` and the log of what it was asked.
 *
 * A scripted `Error` is thrown rather than returned, which is how a refusal reaches a screen.
 * Nothing here decides what an answer means — `useSaveToggle` does — and nothing is cached: a
 * probe asked twice asks the script twice, which is how a test sees a screen that re-asks on
 * focus rather than trusting its own memory. With no script, `probe` has been told nothing and
 * answers `unknown`, the one answer that draws no control at all.
 */
export function fakeSaved(script: Script = {}): {
  readonly port: SavedPort;
  readonly asked: () => readonly Asked[];
} {
  const asked: Asked[] = [];
  // One scripted value per call, in order, the last one repeating; an `Error` in the script is
  // thrown rather than returned, because that is the shape a refusal has by the time it reaches
  // a screen.
  const answer = <T>(list: readonly (T | Error)[], n: number, fallback: T): T => {
    const value = list.length === 0 ? fallback : list[Math.min(n, list.length - 1)]!;
    if (value instanceof Error) throw value;
    return value as T;
  };
  return {
    asked: () => asked,
    port: {
      probe: jest.fn<SavedPort["probe"]>(async (pair, ref) => {
        asked.push({ verb: "probe", pair, ref });
        return answer<KeptAnswer>(script.probes ?? [], asked.length - 1, { state: "unknown" });
      }),
      keep: jest.fn<SavedPort["keep"]>(async (pair, ref, version) => {
        asked.push({ verb: "keep", pair, ref, version });
        return answer(script.writes ?? [], asked.length - 1, { kept: true, held: false });
      }),
      remove: jest.fn<SavedPort["remove"]>(async (pair, id, revision) => {
        asked.push({ verb: "remove", pair, id, revision });
        answer(script.removals ?? [], asked.length - 1, undefined);
      }),
    },
  };
}

/** kept, absent and nobodySaid are the three answers a probe can give, spelled once. */
export const kept = (id = "copy-1", revision = 1): KeptAnswer => ({ state: "kept", id, revision });
export const absent: KeptAnswer = { state: "absent" };
export const nobodySaid: KeptAnswer = { state: "unknown" };
