// props.ts holds the one idiom every component repeats: a testID is passed on
// when there is one and left out when there is not, because
// exactOptionalPropertyTypes refuses `testID={undefined}` and a device flow
// looks an element up by the id a component set (scripts/check_flows.ts).
export const testable = (testID: string | undefined): { readonly testID?: string } =>
  testID ? { testID } : {};
