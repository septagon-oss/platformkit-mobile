// Losing the map is not losing the records. A provider failure keeps the authorized rows and
// their selection; a denial removes markers, selection and detail text so that no coordinate or
// title survives a read that stopped being allowed; a refresh that drops a point drops its selection.
import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCopy,
  deriveMap,
  deriveState,
  type MapInput,
  type MapPoint,
  type Result,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";

function ok<T>(result: Result<T>): T {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
}

for (const language of ["en", "pt"] as const) {
  test(`${language} map withdrawal clears markers and selected records while provider failure keeps the authorized list`, () => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const status = { label: "Pending inspection", tone: "warning", symbol: "clock" } as const;
    const points: MapPoint[] = [
      { id: "west", title: "West archive", longitude: -7, latitude: 31, status, actions: [] },
      { id: "east", title: "East archive", longitude: 9, latitude: 31, status, actions: [] },
      { id: "polar", title: "Polar archive", longitude: 9, latitude: 88, status, actions: [] },
    ];
    const input: MapInput = {
      content: { phase: "ready", refresh: "idle", value: points },
      mode: "map",
      selectedId: "west",
      viewport: { longitude: -7, latitude: 31, zoom: 4 },
      capabilities: { latitudeBounds: [-80, 80], zoomBounds: [1, 18] },
      legend: [status],
      providerState: "ready",
      attribution: "Public fixture",
    };
    const before = JSON.stringify(input);
    const original = ok(deriveMap(input, p)).map;
    assert.equal(original.rows.find((row) => row.selected)?.id, "west");
    assert.deepEqual(
      original.markers.map((marker) => marker.id),
      ["west", "east"],
    );
    assert.equal(original.rows[2]!.reason, p.copy.kit.unsupportedLocation);

    for (const providerState of ["offline", "error", "unsupported"] as const) {
      const failed = ok(deriveMap({ ...input, providerState }, p)).map;
      assert.equal(failed.canRender, false);
      assert.equal(failed.canRetryProvider, providerState !== "unsupported");
      assert.deepEqual(
        failed.rows.map((row) => row.id),
        ["west", "east", "polar"],
      );
      assert.equal(failed.rows.find((row) => row.selected)?.id, "west");
      assert.equal(failed.selectionIssue, undefined);
    }

    for (const code of ["forbidden", "not-found"] as const) {
      const state = ok(
        deriveState(
          {
            kind: "error",
            issue: { code, path: "points", recovery: "immutable", message: p.copy.kit.unavailable },
          },
          p,
        ),
      );
      const denied = ok(deriveMap({ ...input, content: { phase: "error", state } }, p)).map;
      assert.deepEqual(denied.rows, []);
      assert.deepEqual(denied.markers, []);
      assert.equal(denied.writable, false);
      assert.equal(denied.selectionIssue?.code, "unavailable");
      assert.equal(denied.selectionIssue?.message, p.copy.kit.unavailable);
      assert.equal(denied.state?.language, language);
      assert.deepEqual(denied.state?.actions, []);
      for (const point of points) assert.equal(JSON.stringify(denied).includes(point.title), false);
    }

    const removed = ok(
      deriveMap(
        {
          ...input,
          content: { phase: "ready", refresh: "idle", value: points.slice(1) },
        },
        p,
      ),
    ).map;
    assert.equal(
      removed.rows.some((row) => row.selected),
      false,
    );
    assert.equal(removed.selectionIssue?.code, "unavailable");
    assert.deepEqual(
      removed.markers.map((marker) => marker.id),
      ["east"],
    );

    const malformed = deriveMap(
      {
        ...input,
        content: { phase: "ready", refresh: "idle", value: [{ ...points[0]!, latitude: 91 }] },
      },
      p,
    );
    assert.equal(malformed.ok, false);
    assert.equal("value" in malformed, false);
    if (!malformed.ok) assert.equal(malformed.issues[0]!.message, p.copy.issue.invalid);
    assert.deepEqual(ok(deriveMap(input, p)).map, original);
    assert.equal(JSON.stringify(input), before);
    assert.equal(Object.isFrozen(points[0]!.status), false);
    assert.equal(Object.isFrozen(original.rows[0]!.status), true);
    points[0] = { ...points[0]!, title: "Changed draft" };
    assert.equal(original.rows[0]!.title, "West archive");
    assert.equal(ok(deriveMap(input, p)).map.rows[0]!.title, "Changed draft");
  });
}
