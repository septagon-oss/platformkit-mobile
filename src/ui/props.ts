// props.ts holds the one idiom every component repeats: a testID is passed on
// when there is one and left out when there is not, because
// exactOptionalPropertyTypes refuses `testID={undefined}` and a device flow
// looks an element up by the id a component set (scripts/check_flows.ts).
export const testable = (testID: string | undefined): { readonly testID?: string } =>
  testID ? { testID } : {};

// Which spelling carries "this is the one that stands" depends on the role.
// WAI-ARIA 1.2 permits aria-selected on tab, option, row and gridcell alone,
// and Chromium drops it on every other role: a role="button" that claims it
// announces nothing at all. A toggle button's own state is aria-pressed, which
// react-native-web writes onto the element but React Native's native side does
// not read (Libraries/Components/View + AccessibilityProps.cpp fold only
// aria-busy/checked/disabled/expanded/selected and the value quartet), so the
// device half is stated as accessibilityState.selected, which react-native-web
// drops. One fact, each spelling written where that reader looks.
import { Platform, type AccessibilityRole, type AccessibilityState, type View } from "react-native";

/** roles whose ARIA definition carries a selected state */
const SELECTED_ROLES: readonly string[] = ["gridcell", "option", "row", "tab"];

export interface ChosenState {
  readonly "aria-selected"?: boolean;
  readonly "aria-pressed"?: boolean;
  readonly accessibilityState?: AccessibilityState;
}

/** chosenState is the state a control holds when it is the one chosen among alternatives. */
export const chosenState = (
  role: AccessibilityRole,
  selected: boolean | undefined,
): ChosenState => {
  if (selected === undefined) return {};
  if (SELECTED_ROLES.includes(role)) return { "aria-selected": selected };
  return { "aria-pressed": selected, accessibilityState: { selected } };
};

// A search field asks the same question of two readers, and each answers about a
// different thing. In a browser the field's role comes from the element it is:
// react-native-web turns keyboardType "web-search" into <input type="search">,
// whose role is the editable searchbox. Writing role="search" over it replaces
// that with the landmark which names a *region* of a page, and form navigation
// loses the field itself (WAI-ARIA 1.2 distinguishes the two). On a device there
// is no input type to read; accessibilityRole is the only place the fact can
// live, and iOS uses it for the search-field trait. One fact, on the side that
// can read it.
/** searchFieldRole is the role a search input asks for, on the platform that needs it. */
export const searchFieldRole = (): { accessibilityRole?: "search" } =>
  Platform.OS === "web" ? {} : { accessibilityRole: "search" };

// A composite control — a tablist, a toolbar — is one stop in the page's Tab
// order: the chosen item answers to Tab, the arrow keys move the stop between
// items and wrap at the ends, and Tab again leaves the whole control (WAI-ARIA's
// tabs pattern). React Native has no tab order between siblings and delivers no
// key events to a View: each item is its own accessibility element and the
// platform walks them. So the ring below serves the browser alone — it remembers
// the node react-native-web hands each component's ref, which is focusable and
// reports keys — and on a device it stores nothing and adds no prop.
export interface TabStop {
  readonly tabIndex?: 0 | -1;
  readonly onKeyDown?: (event: { readonly key: string; preventDefault: () => void }) => void;
  readonly ref?: (node: View | null) => void;
}

export interface TabRing {
  /** stop is one item's participation: a sequential stop when it is the control's entry, an arrow-reachable one otherwise, nothing at all for an item no keyboard can open. */
  readonly stop: (id: string) => TabStop;
}

/** tabRing is the keyboard inside a composite control: `order` names the items arrows can reach, `chosen` the one Tab enters on, and `enter` is what moving onto an item means. */
export const tabRing = (
  order: readonly string[],
  chosen: string | undefined,
  enter: (id: string) => void,
): TabRing => {
  // A control whose chosen item cannot be opened (a tab withdrawn from) still
  // owes one stop: the first item a keyboard can open takes it.
  const entry = order.includes(chosen ?? "") ? chosen : order[0];
  const nodes = new Map<string, Focusable>();
  const reach = (id: string | undefined): void => {
    if (id === undefined) return;
    nodes.get(id)?.focus();
  };
  const stop = (id: string): TabStop => {
    const at = order.indexOf(id);
    if (at < 0) return {};
    return {
      tabIndex: id === entry ? 0 : -1,
      ref: (node: View | null) => {
        const target = node as unknown as Focusable | null;
        if (target && typeof target.focus === "function") nodes.set(id, target);
        else nodes.delete(id);
      },
      onKeyDown: (event) => {
        const delta = KEY_STEPS[event.key];
        const to =
          event.key === "Home"
            ? order[0]
            : event.key === "End"
              ? order[order.length - 1]
              : delta === undefined
                ? undefined
                : order[(at + delta + order.length) % order.length];
        if (to === undefined) return;
        event.preventDefault();
        reach(to);
        enter(to);
      },
    };
  };
  return { stop };
};

const KEY_STEPS: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

// What react-native-web hands a component's ref on the web: the DOM node. RN's
// own type calls it a View because the device's view holds none of this.
interface Focusable {
  focus: () => void;
}

// React Native's props name no key event because no device delivers one to a
// View; react-native-web forwards it straight to the element
// (modules/forwardedProps/index.js). Declaring that one forwarded prop here keeps
// the boundary honest — it is the browser's, not the device's — and the code
// above free of a cast.
declare module "react-native" {
  interface ViewProps {
    onKeyDown?: (event: { readonly key: string; preventDefault: () => void }) => void;
  }
}

// "Of this related set, this control is the current one" has no shared
// spelling either. ARIA carries it as aria-current; React Native's
// accessibilityState holds only disabled/selected/checked/busy/expanded, so on
// a device the word that says it joins the name. A control's name stays what
// it is called — a day's name is its date, whatever marks it as today — and the
// word a person reads stays on the screen. (Chromium writes aria-current onto
// the element; its CDP accessibility tree exposes no `current` property, so the
// announcement is read from the DOM, not from that tree.)
export interface CurrentProps {
  readonly "aria-current"?: "true";
  readonly accessibilityLabel?: string;
}

/** currentInSet names the control that is the current one in a related set. */
export const currentInSet = (word: string | undefined, name: string): CurrentProps => {
  if (word === undefined) return { accessibilityLabel: name };
  return Platform.OS === "web"
    ? { "aria-current": "true", accessibilityLabel: name }
    : { accessibilityLabel: `${name}, ${word}` };
};
