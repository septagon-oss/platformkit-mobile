import React from "react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import { parseCatalog, type Catalog, type Entry } from "../../src/core/catalog";
import { rowMedia, type ImageSlotProps } from "../../src/core/derive";
import { ApiError, createApi } from "../../src/effects/api";
import { fileResource } from "../../src/effects/files";
import { usePictures } from "../../src/screens/usePictures";
import { ResourceList } from "../../src/screens/ResourceList";
import { RowMedia } from "../../src/ui/molecules/RowMedia";
import { ThemeProvider } from "../../src/ui/theme";
import { fakeApi, shell, shellValue } from "../fakes/shell";
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
const REF = "c1.YQ";
const OTHER = "c1.w6k";
const FILE = "2f3b6eb5-4e14-4fa5-a294-28c98eb14f75";
const doc = () => JSON.parse(readFileSync("testdata/catalog.composed.json", "utf8"));
const catalog = () => parseCatalog(doc());
const slot = (id = REF, instance = "first"): ImageSlotProps => ({
  id,
  instance,
  fit: "cover",
  description: "",
  decorative: true,
  aspectRatio: 1,
});
function installed(served = catalog()) {
  const api = fakeApi();
  api.composedPicture.mockResolvedValue(XML);
  shell.value = shellValue(api, {
    identity: { userId: "reader-a", email: "reader@example.test", permissions: [] },
    state: { phase: "ready", generation: 1, catalog: served },
    entry: (module, entity) =>
      served.resources.find((e) => e.module === module && e.entity === entity),
  });
  return api;
}
beforeEach(resetAsked);
afterEach(() => {
  shell.value = undefined;
});

test("composed references coalesce reads while their rendered slots settle independently beside a stored file", async () => {
  const served = catalog();
  const files: Entry = {
    ...served.resources[0]!,
    module: "file",
    entity: "file",
    path: "/api/v1/file/files",
    operations: ["read"],
  };
  const mixed: Catalog = {
    ...served,
    resources: [...served.resources, files],
    pictures: { ...served.pictures, source: "/api/v1/file/files/{id}/content", widths: [160, 640] },
  };
  const api = installed(mixed);
  api.get.mockResolvedValue({ id: FILE, width: 900, sha256: "stored-v1", visibility: "private" });
  const view = await renderHook(() => usePictures([REF, REF, OTHER, FILE]));
  await waitFor(() => expect(view.result.current.renderImage(slot(OTHER))).not.toBeNull());
  expect(api.composedPicture).toHaveBeenCalledTimes(2);
  expect(api.composedPicture.mock.calls.map((call) => call.slice(0, 2))).toEqual([
    [served.pictures!.composedSource, REF],
    [served.pictures!.composedSource, OTHER],
  ]);
  expect(api.get.mock.calls).toEqual([[files, FILE]]);
  const first = view.result.current.renderImage(slot())!;
  const second = view.result.current.renderImage(slot(REF, "second"))!;
  expect(first.props.resource).toBe(second.props.resource);
  expect(first.props.resource).toEqual(expect.objectContaining({ kind: "svg", xml: XML, id: REF }));
  expect(JSON.stringify(first.props.resource)).not.toMatch(/pk_live|Cookie|Authorization/);
  await act(() => first.props.onState(REF, "ready"));
  await act(() => second.props.onState(REF, "error"));
  expect(view.result.current.states.first).toBe("ready");
  expect(view.result.current.states.second).toBe("error");
  expect(view.result.current.renderImage(slot(REF, "second"))).toBeNull();
  expect(view.result.current.renderImage(slot())).not.toBeNull();
  expect(view.result.current.renderImage(slot(FILE))?.props.resource.uri).toMatch(/\?w=160$/);
});

test.each([
  new ApiError(403, "Refused"),
  new ApiError(503, "Unavailable"),
  new TypeError("Offline"),
])(
  "a composed refresh withdraws old XML immediately and stays empty after %s while a peer waits",
  async (error) => {
    const api = installed();
    const view = await renderHook((visit: number) => usePictures([REF, OTHER], visit), {
      initialProps: 0,
    });
    await waitFor(() => expect(view.result.current.renderImage(slot(OTHER))).not.toBeNull());
    const old = view.result.current.renderImage(slot())!;
    await act(() => old.props.onState(REF, "ready"));
    const refused = Promise.withResolvers<string>();
    const peer = Promise.withResolvers<string>();
    api.composedPicture.mockImplementation((_source, id) =>
      id === REF ? refused.promise : peer.promise,
    );
    await view.rerender(1);
    expect(view.result.current.renderImage(slot())).toBeNull();
    expect(view.result.current.renderImage(slot(OTHER))).toBeNull();
    await act(async () => refused.reject(error));
    expect(view.result.current.states[REF]).toBe("error");
    await act(() => old.props.onState(REF, "ready"));
    expect(view.result.current.renderImage(slot())).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
    api.composedPicture.mockResolvedValue(XML);
    await view.rerender(2);
    await waitFor(() => expect(view.result.current.renderImage(slot())).not.toBeNull());
    const current = view.result.current.renderImage(slot())!.props.resource;
    await act(async () => peer.resolve("<svg></svg>"));
    expect(view.result.current.renderImage(slot())!.props.resource).toBe(current);
  },
);

test.each(
  [
    "reference",
    "source",
    "attempt",
    "catalogue",
    "server",
    "person",
    "key",
    "session",
    "connection",
  ].flatMap((dimension) => [
    { dimension, refused: false },
    { dimension, refused: true },
  ]),
)(
  "obsolete composed settlement (refused: $refused) and callbacks cannot alter a changed $dimension",
  async ({ dimension, refused }) => {
    const api = installed();
    const view = await renderHook(
      ({ id, visit }: { id: string; visit: number }) => usePictures([id], visit),
      { initialProps: { id: REF, visit: 0 } },
    );
    await waitFor(() => expect(view.result.current.renderImage(slot())).not.toBeNull());
    const old = view.result.current.renderImage(slot())!;
    const oldRead = Promise.withResolvers<string>();
    const signals: AbortSignal[] = [];
    api.composedPicture.mockImplementation((_source, _id, options) => {
      if (options?.signal) signals.push(options.signal);
      return oldRead.promise;
    });
    await view.rerender({ id: REF, visit: 1 });
    const latest = Promise.withResolvers<string>();
    api.composedPicture.mockReturnValue(latest.promise);
    let id = REF,
      visit = 1;
    if (dimension === "reference") id = OTHER;
    if (dimension === "attempt") visit = 2;
    if (dimension === "source" || dimension === "catalogue") {
      const served = catalog();
      if (dimension === "source")
        (served as { pictures: { composedSource: string } }).pictures = {
          composedSource: "/api/v1/alternate/{reference}/content",
        };
      shell.value = { ...shell.value!, state: { ...shell.value!.state, catalog: served } };
    }
    if (dimension === "server")
      shell.value = { ...shell.value!, baseURL: "https://other.example.test" };
    if (dimension === "person")
      shell.value = {
        ...shell.value!,
        identity: { userId: "reader-b", email: "other@example.test", permissions: [] },
      };
    if (dimension === "key") api.bearer.mockReturnValue({ id: "next-key", token: "pk_live_next" });
    if (dimension === "session")
      shell.value = { ...shell.value!, state: { ...shell.value!.state, generation: 2 } };
    if (dimension === "connection")
      shell.value = {
        ...shell.value!,
        api: { ...api, composedPicture: async () => latest.promise },
      };
    await view.rerender({ id, visit });
    expect(signals[0]?.aborted).toBe(true);
    await act(async () => {
      if (refused) oldRead.reject(new ApiError(403, "Refused"));
      else oldRead.resolve(XML);
      old.props.onState(REF, "error");
    });
    expect(view.result.current.renderImage(slot(id))).toBeNull();
    await act(async () => latest.resolve(XML));
    await waitFor(() => expect(view.result.current.renderImage(slot(id))).not.toBeNull());
    const active = view.result.current.renderImage(slot(id))!.props.resource;
    await act(() => old.props.onState(REF, "ready"));
    expect(view.result.current.renderImage(slot(id))!.props.resource).toBe(active);
    expect(view.result.current.states.first).toBeUndefined();
    await view.unmount();
    await act(() => old.props.onState(REF, "error"));
  },
);

test("removed and remounted composed references get fresh reads and late failures are ignored", async () => {
  const api = installed();
  const pending = Promise.withResolvers<string>();
  api.composedPicture.mockReturnValue(pending.promise);
  const view = await renderHook((ids: string[]) => usePictures(ids), { initialProps: [REF] });
  const signal = api.composedPicture.mock.calls[0]![2]!.signal!;
  await view.rerender([]);
  expect(signal.aborted).toBe(true);
  await act(async () => pending.reject(new ApiError(403, "Refused")));
  api.composedPicture.mockResolvedValue(XML);
  await view.rerender([REF]);
  await waitFor(() => expect(view.result.current.renderImage(slot())).not.toBeNull());
  expect(api.composedPicture).toHaveBeenCalledTimes(2);
  await view.unmount();
  const mounted = await renderHook(() => usePictures([REF]));
  await waitFor(() => expect(mounted.result.current.renderImage(slot())).not.toBeNull());
  expect(api.composedPicture).toHaveBeenCalledTimes(3);
});

test("missing composed door or invalid references settle empty without file reads, preserving legacy file delivery", async () => {
  const served = { ...catalog(), pictures: { source: "/api/v1/file/files/{id}/content" } };
  const api = installed(served);
  const view = await renderHook(() => usePictures([REF, "c1.YR"]));
  await waitFor(() => expect(view.result.current.states[REF]).toBe("error"));
  expect(view.result.current.renderImage(slot())).toBeNull();
  expect(api.composedPicture).not.toHaveBeenCalled();
  expect(api.get).not.toHaveBeenCalled();
  const legacy = fileResource({
    pictures: catalog().pictures,
    server: "https://legacy.example.test",
    userId: "reader",
    key: api.bearer(),
    entry: served.resources[0],
    id: FILE,
    version: "",
    width: 0,
    attempt: 0,
  });
  expect(legacy?.uri).toBe(`https://legacy.example.test/api/v1/note/notes/${FILE}/content`);
});

function Tile({ entry, visit }: { readonly entry: Entry; readonly visit: number }) {
  const media = usePictures([REF], visit);
  return (
    <ThemeProvider mode="light">
      <RowMedia
        model={rowMedia(entry, { drawing: REF }, media.enabled, media.states)}
        renderImage={media.renderImage}
        testID="tile"
      />
    </ThemeProvider>
  );
}
test("a real parsed SVG enters the compact slot and a parse failure uses the declared icon or no tile", async () => {
  const served = catalog();
  const api = installed(served);
  const entry = served.resources[0]!;
  const view = await render(<Tile entry={entry} visit={0} />);
  await waitFor(() =>
    expect(svgNodes(screen.toJSON()).some((n) => n.type === "RNSVGCircle")).toBe(true),
  );
  expect(nativeRequests).toHaveLength(0);
  api.composedPicture.mockResolvedValue("<svg><g></svg>");
  await view.rerender(<Tile entry={entry} visit={1} />);
  await waitFor(() => expect(svgNodes(screen.toJSON())).toEqual([]));
  expect(screen.getByTestId("tile", { includeHiddenElements: true })).toBeOnTheScreen();
  await view.rerender(
    <Tile entry={{ ...entry, hints: { thumbnailField: "drawing" } }} visit={2} />,
  );
  await waitFor(() =>
    expect(screen.queryByTestId("tile", { includeHiddenElements: true })).toBeNull(),
  );
});

test("a generated list over the real API renders Oracle geometry and withdraws a 403 before its peer finishes", async () => {
  const served = catalog();
  let refresh = false;
  const peer = Promise.withResolvers<Response>();
  const calls: { url: string; init: RequestInit }[] = [];
  const api = createApi("https://pictures.example.test", async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/auth/login"))
      return loginResponse({
        headers: { "Set-Cookie": "platformkit_session=synthetic; HttpOnly" },
      });
    if (url.endsWith("/auth/tokens")) return issuedTokenResponse();
    if (url.endsWith("/content")) {
      if (refresh)
        return url.includes(REF) ? new Response("refused", { status: 403 }) : peer.promise;
      return new Response(XML, { headers: { "Content-Type": "image/svg+xml" } });
    }
    return pageResponse({
      items: [
        { id: "shape", title: "Shape study", drawing: REF },
        { id: "peer", title: "Other study", drawing: OTHER },
      ],
      total: 2,
    });
  });
  await api.signIn("member@example.test", "synthetic-password");
  shell.value = shellValue(api, {
    baseURL: "https://pictures.example.test",
    identity: { userId: "reader", email: "member@example.test", permissions: [] },
    state: { phase: "ready", generation: 1, catalog: served },
    entry: () => undefined,
  });
  const view = await render(
    <ThemeProvider mode="light">
      <ResourceList entry={served.resources[0]!} />
    </ThemeProvider>,
  );
  await waitFor(() =>
    expect(svgNodes(screen.toJSON()).filter((n) => n.type === "RNSVGCircle")).toHaveLength(2),
  );
  expect(screen.getByText("Shape study")).toBeOnTheScreen();
  expect(nativeRequests).toHaveLength(0);
  refresh = true;
  await act(async () => fireEvent(screen.getByTestId("resource-list"), "refresh"));
  await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/content"))).toHaveLength(4));
  expect(svgNodes(screen.toJSON()).filter((n) => n.type === "RNSVGCircle")).toHaveLength(0);
  expect(screen.getByTestId("row-shape")).toBeOnTheScreen();
  expect(screen.getByTestId("row-peer")).toBeOnTheScreen();
  expect(screen.getByText("Shape study")).toBeOnTheScreen();
  for (const call of calls.filter((c) => c.url.endsWith("/content"))) {
    expect(call.init.headers).toEqual(
      expect.objectContaining({ Cookie: "platformkit_session=synthetic" }),
    );
    expect(call.init.headers).not.toHaveProperty("Authorization");
    expect(call.url).not.toContain("?");
  }
  await view.unmount();
  await act(async () =>
    peer.resolve(new Response(XML, { headers: { "Content-Type": "image/svg+xml" } })),
  );
});

test.each(["identity", "key", "phase"])(
  "no composed read starts without a ready %s",
  async (missing) => {
    const api = installed();
    if (missing === "identity") shell.value = { ...shell.value!, identity: undefined };
    if (missing === "key") api.bearer.mockReturnValue(undefined);
    if (missing === "phase")
      shell.value = { ...shell.value!, state: { ...shell.value!.state, phase: "loading" } };
    const view = await renderHook(() => usePictures([REF]));
    expect(view.result.current.enabled).toBe(false);
    expect(view.result.current.renderImage(slot())).toBeNull();
    expect(api.composedPicture).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
  },
);

test("a failed final composed slot releases its resource and adding a peer never restores or refetches it", async () => {
  const api = installed();
  const view = await renderHook((ids: string[]) => usePictures(ids), { initialProps: [REF] });
  await waitFor(() => expect(view.result.current.renderImage(slot())).not.toBeNull());
  const failed = view.result.current.renderImage(slot())!;
  await act(() => failed.props.onState(REF, "error"));
  expect(view.result.current.renderImage(slot())).toBeNull();
  await view.rerender([REF, OTHER]);
  await waitFor(() => expect(view.result.current.renderImage(slot(OTHER))).not.toBeNull());
  expect(api.composedPicture).toHaveBeenCalledTimes(2);
  expect(view.result.current.renderImage(slot())).toBeNull();
  await act(() => failed.props.onState(REF, "ready"));
  expect(view.result.current.renderImage(slot())).toBeNull();
});
