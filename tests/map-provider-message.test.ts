import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy, deriveMap, type MapInput } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

const input: MapInput = {
  content: { phase: "ready", refresh: "idle", value: [] },
  mode: "map",
  viewport: { longitude: -9, latitude: 38, zoom: 7 },
  legend: [],
  capabilities: { latitudeBounds: [-80, 80], zoomBounds: [1, 18] },
  providerState: "ready",
  attribution: "Example map data",
};

test("map provider failures name their actual state in each language", () => {
  for (const language of ["en", "pt"] as const) {
    const p = { ...presentation, copy: deriveCopy(language) };
    for (const [providerState, message] of [
      ["offline", p.copy.state.offline.body],
      ["error", p.copy.state.error.body],
      ["unsupported", p.copy.issue.unsupported],
    ] as const) {
      const result = deriveMap({ ...input, providerState }, p);
      assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
      assert.equal(result.value.map.providerIssue, message, `${language}/${providerState}`);
    }
  }
});
