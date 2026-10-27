// The three copies this repository draws from the kernel — the catalogue golden every screen derives
// from, the served HTTP document `src/generated` is generated from, and the parity fixtures the phone's
// models are held to — are one kernel commit's bytes. Each copy's own record is proved by its own script
// (`catalog.ts`, `api.ts`, `parity.ts`), so nothing here would notice a re-pin that moved one copy and
// left the other two answering for a kernel this phone no longer runs: the agreement the parity suite
// claims is only as true as the commit all three name.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const KERNEL = "https://github.com/septagon-oss/platformkit";
const COPIES = [
  "testdata/catalog.source.json",
  "testdata/openapi.source.json",
  "tests/parity/parity.source.json",
];

const upstreamOf = (name: string): Record<string, string> => {
  const record = JSON.parse(readFileSync(name, "utf8")) as { upstream?: Record<string, string> };
  assert.ok(record.upstream, `${name}: records no upstream`);
  return record.upstream;
};

test("the phone's three kernel copies name one commit of one repository", () => {
  const commits = COPIES.map((name) => {
    const up = upstreamOf(name);
    assert.match(
      up.commit ?? "",
      /^[0-9a-f]{40}$/,
      `${name}: upstream.commit is not a full kernel commit ID`,
    );
    assert.equal(up.repository, KERNEL, `${name}: copied from somewhere other than the kernel`);
    assert.ok(
      (up.command ?? "").includes(up.commit as string),
      `${name}: its command fetches different bytes than the record names`,
    );
    assert.ok((up.path ?? "").length > 0, `${name}: the record names no file it was copied from`);
    return up.commit as string;
  });
  assert.deepEqual(
    [...new Set(commits)],
    [commits[0]],
    "a presentation copy moved to another kernel commit while the others stayed",
  );
});
