// A composed picture the server refuses draws the kit's empty picture in its own row — the
// entry's declared icon, or neither glyph nor SVG when it declares none — while a peer row's SVG renders.
import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
import { parseCatalog, type Entry } from "../../src/core/catalog";
import { createApi } from "../../src/effects/api";
import { ResourceList } from "../../src/screens/ResourceList";
import { ThemeProvider } from "../../src/ui/theme";
import { shell, shellValue } from "../fakes/shell";
import { nativeRequests, resetAsked } from "../fakes/image";
import { issuedTokenResponse, loginResponse, pageResponse } from "../fakes/wire";
import { svgNodes } from "../fakes/svg";

jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").expoRouter,
);
jest.mock(
  "expo-router/react-navigation",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").reactNavigation,
);
jest.mock("expo-image", () => ({
  Image: jest.requireActual<typeof import("../fakes/image")>("../fakes/image").ExpoImage,
}));

const XML = readFileSync("testdata/composed-picture.svg", "utf8");
// "kite/blue" and "kite/red": two source keys chosen for this case, not the suite's own.
const REFUSED = "c1.a2l0ZS9ibHVl";
const SHOWN = "c1.a2l0ZS9yZWQ";
// The glyph the catalogue's declared `document` icon draws, read from the icon set itself.
const DOCUMENT_GLYPH = String.fromCodePoint(
  (Ionicons.glyphMap as Record<string, number>)["document-text-outline"]!,
);

beforeEach(resetAsked);
afterEach(() => {
  shell.value = undefined;
});

interface Node {
  readonly type?: string;
  readonly props?: Record<string, unknown>;
  readonly children?: readonly unknown[];
}
/** rendered is the drawn subtree of one row, found by the testID the list sets on it. */
function rendered(testID: string, tree: unknown = screen.toJSON()): Node | undefined {
  if (!tree || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) return tree.map((t) => rendered(testID, t)).find(Boolean);
  const node = tree as Node;
  if (node.props?.testID === testID) return node;
  return (node.children ?? []).map((c) => rendered(testID, c)).find(Boolean);
}
function all(tree: unknown, match: (n: Node) => boolean): Node[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((t) => all(t, match));
  const node = tree as Node;
  return [...(match(node) ? [node] : []), ...(node.children ?? []).flatMap((c) => all(c, match))];
}
const svgIn = (testID: string) => svgNodes(rendered(testID));
const glyphsIn = (testID: string) =>
  all(rendered(testID), (n) => n.type === "Text" && n.children?.[0] === DOCUMENT_GLYPH);

async function listWithOneRefusal(entry: Entry) {
  const served = parseCatalog(JSON.parse(readFileSync("testdata/catalog.composed.json", "utf8")));
  const sent: { url: string; headers: Record<string, string> }[] = [];
  const api = createApi("https://kites.example.test", async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/auth/login"))
      return loginResponse({ headers: { "Set-Cookie": "platformkit_session=kites; HttpOnly" } });
    if (url.endsWith("/auth/tokens")) return issuedTokenResponse();
    if (url.endsWith("/content")) {
      sent.push({ url, headers: init.headers as Record<string, string> });
      return url.includes(REFUSED)
        ? new Response(
            JSON.stringify({ status: 403, detail: "access to this picture was refused" }),
            {
              status: 403,
              headers: { "Content-Type": "application/problem+json" },
            },
          )
        : new Response(XML, { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } });
    }
    return pageResponse({
      items: [
        { id: "blue", title: "Blue kite", drawing: REFUSED },
        { id: "red", title: "Red kite", drawing: SHOWN },
      ],
      total: 2,
    });
  });
  await api.signIn("flyer@example.test", "synthetic-password");
  shell.value = shellValue(api, {
    baseURL: "https://kites.example.test",
    identity: { userId: "flyer", email: "flyer@example.test", permissions: [] },
    state: { phase: "ready", generation: 1, catalog: served },
    entry: () => undefined,
  });
  await render(
    <ThemeProvider mode="light">
      <ResourceList entry={entry} />
    </ThemeProvider>,
  );
  await waitFor(() => expect(svgIn("row-red").length).toBeGreaterThan(0));
  await waitFor(() => expect(sent).toHaveLength(2));
  for (const request of sent) {
    expect(request.headers.Cookie).toBe("platformkit_session=kites");
    expect(request.headers).not.toHaveProperty("Authorization");
  }
  expect(nativeRequests).toHaveLength(0);
  return served;
}

test("a refused composed picture draws the entry's declared icon in its row while the peer's SVG renders", async () => {
  const served = parseCatalog(JSON.parse(readFileSync("testdata/catalog.composed.json", "utf8")));
  await listWithOneRefusal(served.resources[0]!);
  await waitFor(() => expect(glyphsIn("row-blue").length).toBeGreaterThan(0));
  expect(svgIn("row-blue")).toHaveLength(0);
  expect(glyphsIn("row-red")).toHaveLength(0);
  expect(screen.getByText("Blue kite")).toBeOnTheScreen();
});

test("a refused composed picture of an entry with no declared icon draws neither a glyph nor an SVG in its row", async () => {
  const served = parseCatalog(JSON.parse(readFileSync("testdata/catalog.composed.json", "utf8")));
  const entry = served.resources[0]!;
  await listWithOneRefusal({ ...entry, hints: { thumbnailField: "drawing" } });
  await waitFor(() => expect(svgIn("row-blue")).toHaveLength(0));
  expect(glyphsIn("row-blue")).toHaveLength(0);
  expect(svgIn("row-red").length).toBeGreaterThan(0);
  expect(screen.getByText("Blue kite")).toBeOnTheScreen();
});
