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
import type { AccessibilityRole, AccessibilityState } from "react-native";

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
