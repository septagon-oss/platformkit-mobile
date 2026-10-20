// expo-notifications as a test sees it: the platform's answers, held where a test can move
// them. The bridge under test is the real one (`src/screens/push.ts`) over these answers, so
// the token's shape, the channel call and the throw of a build nobody can send to are the
// library's behaviour and not a double's. Nothing here asserts; the tests do.
import { jest } from "@jest/globals";

/** The one action identifier a plain tap carries. */
export const DEFAULT_ACTION_IDENTIFIER = "expo.modules.notifications.actions.DEFAULT";

/** Platform is what a test sets before it renders: the phone's answers, not this file's. */
export const platform: {
  /** permission is what the platform already recorded, before anybody was asked. */
  permission: boolean;
  /** ask is the answer to the system prompt, and `asks` counts how often it was opened. */
  ask: boolean;
  asks: number;
  /** token is the address a push service handed out; nothing stands for no push service. */
  token: string | undefined;
  /** tokenType is the token's own kind, which the bridge reads before it trusts the value. */
  tokenType: string;
  /** held is what the token answer waits for first: a refresh a test resolves by hand. */
  held: Promise<void> | undefined;
  /** tap is what `useLastNotificationResponse` answers: the notification the person pressed. */
  tap: unknown;
  /** channels records every channel this app named, with the name it gave it. */
  channels: string[];
} = {
  permission: false,
  ask: false,
  asks: 0,
  token: undefined,
  tokenType: "expo",
  held: undefined,
  tap: undefined,
  channels: [],
};

export function resetPush(): void {
  platform.permission = false;
  platform.ask = false;
  platform.asks = 0;
  platform.token = undefined;
  platform.tokenType = "expo";
  platform.held = undefined;
  platform.tap = undefined;
  platform.channels.length = 0;
}

/** tapped is the response a notification tap leaves: the identifier, the action and the link. */
export function tapped(link: unknown, identifier = "notification-1"): unknown {
  return {
    identifier,
    actionIdentifier: DEFAULT_ACTION_IDENTIFIER,
    notification: {
      request: { identifier, content: { data: link === undefined ? {} : { link } } },
    },
  };
}

export const expoNotifications = {
  AndroidImportance: { MIN: 3, LOW: 4, DEFAULT: 5, HIGH: 6 },
  DEFAULT_ACTION_IDENTIFIER,
  setNotificationChannelAsync: jest.fn(async (id: string, channel: { name: string }) => {
    platform.channels.push(`${id}=${channel.name}`);
    return { id, ...channel };
  }),
  getPermissionsAsync: jest.fn(async () => ({ granted: platform.permission })),
  requestPermissionsAsync: jest.fn(async () => {
    platform.asks += 1;
    // The platform records the answer, and every later read of the permission is that record:
    // a test that sets `ask` is saying what the prompt answers, not what it already said.
    platform.permission = platform.ask;
    return { granted: platform.permission };
  }),
  getExpoPushTokenAsync: jest.fn(async () => {
    if (platform.held !== undefined) await platform.held;
    if (platform.token === undefined)
      throw new Error("expo push: this build carries no push credential");
    return { type: platform.tokenType, data: platform.token };
  }),
  useLastNotificationResponse: () => platform.tap,
};
