// native-reach.ts puts expo-network behind the one question the outbox asks the
// network: is it worth trying. The answer is a trigger and a hint and never an
// authority — isInternetReachable is optional and often undefined at first — so
// the queue's authority stays what it always was: whether a request actually
// reached the server.
import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";

export interface Reach {
  readonly up: () => boolean | undefined;
  /** subscribe says what a listener must undo; the first answer arrives async. */
  readonly subscribe: (listener: (up: boolean) => void) => () => void;
}

export function createReach(): Reach {
  let up: boolean | undefined;
  const listeners = new Set<(up: boolean) => void>();

  function seen(reachable: boolean): void {
    if (up === reachable) return;
    up = reachable;
    for (const listener of [...listeners]) listener(reachable);
  }

  return {
    up: () => up,
    subscribe: (listener) => {
      listeners.add(listener);
      const subscription = addNetworkStateListener((event) =>
        seen(event.isConnected === true && event.isInternetReachable !== false),
      );
      void getNetworkStateAsync().then((state) =>
        seen(state.isConnected === true && state.isInternetReachable !== false),
      );
      return () => {
        listeners.delete(listener);
        subscription.remove();
      };
    },
  };
}
