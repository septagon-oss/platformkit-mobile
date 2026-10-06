// The router as a test sees it: every expo-router hook the screens call,
// answering from objects the test reads and resets. A test installs it with
// jest.mock("expo-router", () => require("./fakes/router").expoRouter) and the
// same for "expo-router/react-navigation"; the module instance the test
// imports is the one the mock hands out.
import { jest } from "@jest/globals";
import React from "react";
import { Text } from "react-native";

export const router = {
  push: jest.fn<(href: string) => void>(),
  replace: jest.fn<(href: string) => void>(),
  back: jest.fn<() => void>(),
  canGoBack: jest.fn<() => boolean>(() => true),
};

export const navigation = { dispatch: jest.fn<(action: unknown) => void>() };

/** Dismissal is what usePreventRemove hands its callback: the navigation action that was refused. */
export interface Dismissal {
  readonly data: { readonly action: unknown };
}

/** prevent is the last usePreventRemove registration: whether the guard is on, and what a refused dismissal asks. */
export const prevent: { enabled: boolean; ask: ((e: Dismissal) => void) | undefined } = {
  enabled: false,
  ask: undefined,
};

/** params is what useLocalSearchParams answers; setParams changes it before a render. */
let params: Record<string, string | undefined> = {};
export const setParams = (next: Record<string, string | undefined>): void => {
  params = next;
};

export function reset(): void {
  for (const fn of [router.push, router.replace, router.back, navigation.dispatch]) fn.mockClear();
  router.canGoBack.mockReset();
  router.canGoBack.mockReturnValue(true);
  prevent.enabled = false;
  prevent.ask = undefined;
  params = {};
}

const Nothing = (): null => null;

/** headerBlocks are the two slots a screen may put in the native header. */
interface ScreenOptions {
  readonly headerLeft?: () => React.ReactElement | null;
  readonly headerRight?: () => React.ReactElement | null;
}

/**
 * Screen draws what the navigator would draw from `options`. A screen owns its
 * header buttons — New, Edit, Save, Cancel — and puts them in the header slots
 * rather than in the page, so a fake that rendered `Stack.Screen` as nothing
 * could not see a single one of them: "no New on a resource that offers no
 * create" would be unobservable, and an invisible door is not a tested door.
 */
const Screen = ({ options }: { readonly options?: ScreenOptions }): React.ReactElement =>
  React.createElement(React.Fragment, null, options?.headerLeft?.(), options?.headerRight?.());

export const expoRouter = {
  Stack: Object.assign(Nothing, { Screen }),
  Redirect: ({ href }: { readonly href: string }) =>
    React.createElement(Text, { testID: "redirect" }, href),
  useRouter: () => router,
  useNavigation: () => navigation,
  useLocalSearchParams: () => params,
  // The real hook runs on focus and cleans up on blur; mounted once in a test,
  // that is an effect that re-runs when the callback it was given changes.
  useFocusEffect: (effect: () => void | (() => void)) => {
    React.useEffect(effect, [effect]);
  },
};

export const reactNavigation = {
  usePreventRemove: (enabled: boolean, ask: (e: Dismissal) => void) => {
    prevent.enabled = enabled;
    prevent.ask = ask;
  },
};
