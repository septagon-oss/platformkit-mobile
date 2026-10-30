// The native route dependency must load under the component test transform.
import { expect, test } from "@jest/globals";
import { usePreventRemove } from "expo-router/react-navigation";

test("expo-router navigation imports load in the component runner", () => {
  expect(typeof usePreventRemove).toBe("function");
});
