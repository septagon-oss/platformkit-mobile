// What every component test needs: the native modules that have no JavaScript
// implementation under Jest, mocked to their shape so an atom that uses them
// renders, and React Native's component modules evaluated once before the
// tests start. Nothing here asserts; the tests do.
import { beforeAll, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { Gallery } from "../../src/ui/gallery";
import { ListScreen } from "../../src/ui/templates/ListScreen";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

// The safe area comes from a native provider the router installs at the root;
// under Jest the package's own mock supplies fixed insets.
jest.mock(
  "react-native-safe-area-context",
  () =>
    (jest.requireActual("react-native-safe-area-context/jest/mock") as { default: unknown })
      .default,
);

// The first render in a suite evaluates React Native's component modules
// (ScrollView, FlatList, TextInput, the pickers, Animated) through Babel and a
// fresh module registry. That takes about a second on a workstation and
// several on the verification runner, and it is machine speed, not behaviour:
// paid inside a test it made the first test of a suite fail its five seconds
// on the runner while asserting something that takes two milliseconds. It is
// paid here instead, once per suite, before any test's clock starts, by
// rendering the library's gallery and a list; the bound is generous because
// it measures the machine, and every test keeps its own five seconds for what
// it asserts.
beforeAll(async () => {
  await render(
    <>
      <Gallery />
      <ListScreen
        data={["warm"]}
        keyOf={(item) => item}
        render={(item) => <Text>{item}</Text>}
        loading={false}
        refreshing={false}
        onRefresh={() => undefined}
        empty={null}
      />
    </>,
  );
  await screen.unmount();
}, 120_000);
