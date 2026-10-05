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
import { Platform, type AccessibilityRole, type AccessibilityState } from "react-native";

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
