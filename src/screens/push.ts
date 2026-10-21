// push.ts is the bridge between the session and the platform's push surface: four
// questions and no decisions. It sits in the screens layer because that is where an effect
// becomes a prop — the composition root hands one to `Shell` beside the store, the mint and
// the network listener, and a host that ships no bridge (a web build, a test host) simply
// has no push at all.
//
// What the bridge deliberately does not do: ask. The system prompt is the platform's and it
// appears once per install, so the session asks what the platform already recorded and only
// a person's own answer to a sentence on this phone reaches `ask`. Nor does it hold the
// token anywhere: like the bearer key it lives in memory for as long as the session that
// earned it, never in the secure store, never in a table, never in a sentence.
import {
  AndroidImportance,
  getExpoPushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
} from "expo-notifications";

/**
 * PUSH_PLATFORM names this phone to the server, in the one spelling the kernel's push port
 * reserves for a token reached through Expo's endpoint (`kit/push/push.go`'s `PlatformExpo`).
 * The token itself goes verbatim: the Expo adapter checks what it will not carry and
 * rewrites nothing, and neither half of that is this bridge's to second-guess.
 */
export const PUSH_PLATFORM = "expo";

/**
 * CHANNEL is the Android channel every notification this app shows arrives on. Android 8
 * shows nothing until a channel exists, so it is created at the start of every session
 * rather than at the first notification. The id is this build's and never changes; the name
 * is copy, because a person reads it in the system's own settings.
 */
export const CHANNEL = "platformkit";

/** PushBridge is the platform, asked. Every answer is the platform's, not an inference. */
export interface PushBridge {
  /** channel gives the one channel its user-visible name; it is idempotent by id. */
  readonly channel: (name: string) => Promise<void>;
  /** permission reads what the platform already recorded, without asking anybody. */
  readonly permission: () => Promise<boolean>;
  /** ask is the system prompt, and a person pressing this app's own button is the only way to it. */
  readonly ask: () => Promise<boolean>;
  /** token is the address the server would send to, or nothing where no push service answers. */
  readonly token: () => Promise<string | undefined>;
}

const granted = async (ask: () => Promise<{ granted?: boolean }>): Promise<boolean> =>
  (await ask()).granted === true;

/**
 * createPush makes the one bridge. It throws where the platform has nothing to answer — no
 * push service, a build with no Expo credential, a browser — and the caller treats every
 * throw the same way as a refusal: this phone is not addressable and the session carries on.
 */
export function createPush(): PushBridge {
  return {
    channel: async (name) => {
      // `DEFAULT` is the platform's own middle setting: a notification this app raises is
      // worth looking at, and it is the person's phone that decides what that means.
      await setNotificationChannelAsync(CHANNEL, { name, importance: AndroidImportance.DEFAULT });
    },
    permission: () => granted(getPermissionsAsync),
    ask: () => granted(requestPermissionsAsync),
    token: async () => {
      const found = await getExpoPushTokenAsync();
      return found.type === "expo" ? found.data : undefined;
    },
  };
}
