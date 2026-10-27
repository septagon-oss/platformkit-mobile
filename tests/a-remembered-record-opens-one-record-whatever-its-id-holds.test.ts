// A remembered open's address is typed `RecordAddress`, but a template literal's
// `${string}` matches a slash, a question mark and a hash: the type cannot say "three
// path parts, no query and no fragment". Only the escaping in `address` can, so the
// promise the type's doc makes is asked here of ids that would break it unescaped.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { recentHref, type RecentDoor } from "../src/core/recents";
import { address, type RecordAddress } from "../src/core/reentry";
import { screenPath } from "../src/core/derive";
import { unresolved } from "./fakes/unresolved";

const catalog = parseCatalog(unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8"))));
const note = catalog.resources.find((r) => r.entity === "note")!;

const door = (recordId: string): RecentDoor => ({
  recent: {
    resourceKey: "note/note",
    recordId,
    title: "Planning",
    openedAt: "2026-07-18T09:00:00Z",
  },
  entry: note,
});

test("a remembered record opens one record whatever its id holds", () => {
  const ids = ["n-7", "a/b", "a/b/edit", "q?draft=1", "p#top", "50% off", "ação/2", "%2F"];
  for (const id of ids) {
    const href: RecordAddress = recentHref(door(id));
    assert.equal(href, address("detail", note, id), `${id}: one spelling of a record's route`);
    assert.ok(!href.includes("?") && !href.includes("#"), `${id}: no query and no fragment`);
    const parts = href.split("/");
    assert.equal(parts.length, 4, `${id}: three path parts, not ${parts.length - 1}`);
    assert.equal(`/${parts[1]}/${parts[2]}`, screenPath(note), `${id}: the resource's own screen`);
    assert.equal(decodeURIComponent(parts[3]!), id, `${id}: the id comes back whole`);
  }
});
