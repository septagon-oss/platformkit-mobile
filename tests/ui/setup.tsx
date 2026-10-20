import { feedback, presentation } from "../fakes/presentation";
// What every component test needs: the native modules that have no JavaScript
// implementation under Jest, mocked to their shape so an atom that uses them
// renders, and React Native's component modules evaluated once before the
// tests start. Nothing here asserts; the tests do.
import { beforeAll, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import { noOrder } from "../../src/core/derive";
import { Gallery } from "../../src/ui/gallery";
import { ResourceDetail } from "../../src/ui/organisms/ResourceDetail";
import { ResourceList } from "../../src/ui/organisms/ResourceList";
import { ListScreen } from "../../src/ui/templates/ListScreen";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  // The felt tick a row's swipe gives at its threshold. A double that answers no question a
  // surface asks is a surface whose tests throw on the thing they are there to watch.
  impactAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

// Notifications have no JavaScript implementation under Jest either. The answers are held in
// the fake so a test can move them; every other suite never asks and never notices.
jest.mock("expo-notifications", () => require("../fakes/push").expoNotifications);

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
// The gallery draws every atom, molecule and template but no record screen, so the
// record's list and record page are mounted here as well: without them the first
// test of a suite that mounts one pays that organism's first mount inside its own
// five seconds, which is machine speed and not what the test asserts.
const warmEntry = parseCatalog(
  JSON.parse(readFileSync("testdata/catalog.json", "utf8")),
).resources.find((r) => r.entity === "note")!;
const warmRow = { id: "warm", title: "Warm", status: "open", rank: 1, pinned: false, tags: [] };
const none = () => undefined;

beforeAll(async () => {
  await render(
    <>
      <Gallery presentation={presentation} />
      <ListScreen
        feedback={feedback}
        data={["warm"]}
        keyOf={(item) => item}
        render={(item) => <Text>{item}</Text>}
        loading={false}
        refreshing={false}
        onRefresh={() => undefined}
        empty={null}
      />
      <ResourceList
        presentation={presentation}
        entry={warmEntry}
        rows={[warmRow]}
        total={1}
        loading={false}
        refreshing={false}
        more={false}
        error=""
        order={noOrder}
        onOrder={none}
        onOpen={none}
        onMore={none}
        onRefresh={none}
      />
      <ResourceDetail feedback={feedback} entry={warmEntry} row={warmRow} error="" onRetry={none} />
    </>,
  );
  await screen.unmount();
}, 120_000);
