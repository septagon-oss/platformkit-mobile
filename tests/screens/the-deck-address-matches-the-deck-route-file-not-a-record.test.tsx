// The deck's address is a static segment beside a record's `[id]`, so a spelling that names no
// route file still reaches a screen: the record whose id is that word. Expo Router's own matcher,
// over the app's real route files, must send `address("deck", …)` to the file that draws the deck
// and `rowAt` to the file that draws a record. The root layout is left out of the context: it
// sets no route option, and loading it would start the whole shell.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import path from "node:path";
import React from "react";
import type { RouteNode } from "expo-router/build/Route";
import { getRoutes } from "expo-router/build/getRoutes";
import { getNavigationConfig } from "expo-router/build/getLinkingConfig";
import { getStateFromPath } from "expo-router/build/fork/getStateFromPath";
import { requireContext } from "expo-router/internal/testing";
import { address, rowAt } from "../../src/core/reentry";
import { deckEntryFixture } from "../fakes/deck";

const mockDrawn: string[] = [];
jest.mock("../../src/route", () => ({
  ResourceRoute: ({ kind }: { kind: string }) => {
    mockDrawn.push(kind);
    return null;
  },
}));

const app = requireContext(
  path.resolve(__dirname, "../../app"),
  true,
  /^\.\/(?!_layout\.tsx$).*\.tsx$/,
);
const routes = getRoutes(app, { platform: "android", skipGenerated: true })!;
const config = getNavigationConfig(routes, true, { sitemap: false, notFound: false });
const entry = deckEntryFixture();

type Level = { routes: { name: string; state?: Level }[]; index?: number };

/** fileAt is the route file Expo Router matches for href, by walking the matched state down
 * the route tree; undefined when the router matches nothing. */
function fileAt(href: string): string | undefined {
  let level = (getStateFromPath(href, config) as Level | undefined)?.routes[0]?.state;
  let node: RouteNode = routes;
  while (level) {
    const name = level.routes[level.index ?? level.routes.length - 1]!.name;
    const child = node.children.find((c) => c.route === name);
    if (!child) return undefined;
    node = child;
    level = level.routes[level.index ?? level.routes.length - 1]!.state;
  }
  return node === routes ? undefined : node.contextKey;
}

async function drawnBy(file: string): Promise<string[]> {
  mockDrawn.length = 0;
  const Screen = (app(file) as { default: React.ComponentType }).default;
  await render(<Screen />);
  return [...mockDrawn];
}

beforeEach(() => {
  mockDrawn.length = 0;
});

test("the queue button's address matches the route file that draws the deck", async () => {
  const file = fileAt(address("deck", entry));
  expect(file).toBeDefined();
  expect(await drawnBy(file!)).toEqual(["deck"]);
});

test("a card's record address matches the route file that draws a record", async () => {
  const file = fileAt(rowAt(entry.module, entry.entity, "a/b c?#%"));
  expect(file).toBeDefined();
  expect(await drawnBy(file!)).toEqual(["detail"]);
});
