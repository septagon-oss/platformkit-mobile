// device.ts is the composition root's list of what this app keeps on the phone:
// the one database file, the one maker of idempotency keys, the one network
// listener. It sits in the screens layer because that is where an effect becomes
// a prop — a route may hand these to `Shell`, but may not reach an effect itself.
// Nothing here opens anything: the kit opens a table only when a command asks it
// to, and a host that supplies no store has no queue and no cache at all.
import { randomUUID } from "expo-crypto";
import { deviceStore } from "../effects/native-store";
import { createReach, type Reach } from "../effects/native-reach";
import type { OutboxStore } from "../effects/outbox";
import type { RecentsStore } from "../effects/recents";
import type { ReadStore } from "../effects/read-cache";

export interface Device {
  readonly store: {
    readonly outbox: OutboxStore;
    readonly reads: ReadStore;
    readonly recents: RecentsStore;
  };
  readonly mint: () => string;
  readonly reach: Reach;
}

/**
 * device is one value for the life of the process: a second store is a second
 * handle on the same file, a second reach is a second queue being told when to
 * run, and a mint that could repeat a key is worse than no key at all.
 */
export const device: Device = Object.freeze({
  store: Object.freeze({
    outbox: deviceStore.outbox,
    reads: deviceStore.reads,
    recents: deviceStore.recents,
  }),
  mint: randomUUID,
  reach: createReach(),
});
