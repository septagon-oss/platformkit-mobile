// A person's disc colour is a function of their id alone: the same id reads the same
// tone in a directory row, in a field that points at them, as an activity actor and as
// the signed-in account, and no id ever reads the danger tone. The vectors below were
// computed outside this repository (FNV-1a, 32-bit, over UTF-16 code units, modulo the
// four safe tones in the order info, ok, warning, neutral), so a change to the hash is
// a diff somebody reads rather than a colour every person silently loses.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import {
  accountPerson,
  avatar,
  avatarTone,
  deriveEventActivity,
  listRow,
  personValue,
} from "../src/core/derive";
import { feedback, presentation } from "./fakes/presentation";

const vectors = [
  ["9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a", "ok"],
  ["6b1d0f3e-8a2c-4e57-9d14-3c5a7e9b2f60", "info"],
  ["ced4977a-e66c-4968-8fc8-f826017602d9", "warning"],
  ["11111111-1111-4111-8111-111111111111", "neutral"],
  ["00000000-0000-4000-8000-000000000000", "ok"],
  ["ffffffff-ffff-4fff-bfff-ffffffffffff", "neutral"],
  ["\u{1F600}x", "info"],
] as const;

test("a person's tone is the independently computed vector for their id", () => {
  for (const [id, tone] of vectors) assert.equal(avatarTone(id), tone, id);
});

test("no identifier reads the danger tone, and each reads the same tone every time", () => {
  for (let i = 0; i < 20000; i++) {
    const id = randomUUID();
    const tone = avatarTone(id);
    assert.notEqual(tone, "danger", id);
    assert.ok(["info", "ok", "warning", "neutral"].includes(tone), id);
    assert.equal(avatarTone(id), tone, id);
  }
});

test("the same person reads one tone in a row, a reference, the trail and the account", () => {
  const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.pictures.json", "utf8")));
  const users = catalog.resources.find((e) => e.module === "user" && e.entity === "user")!;
  const tasks = catalog.resources.find((e) => e.module === "task" && e.entity === "task")!;
  const assignee = tasks.fields.find((f) => f.hints?.reference?.resource === "user/user")!;
  for (const [id, tone] of vectors.slice(0, 4)) {
    const row = listRow(
      users,
      { id, email: "marta@example.test", displayName: "Marta Reis" },
      feedback,
      feedback.copy.kit.untitled,
    );
    assert.equal(row.avatar?.tone, tone, `directory row ${id}`);

    const reference = personValue(assignee, id, feedback, {
      [`user/user|${id}`]: "Marta Reis",
    });
    assert.equal(reference?.people[0]?.tone, tone, `reference ${id}`);

    const trail = deriveEventActivity(
      {
        events: [
          { id: "event-1", name: "task.updated", occurredAt: "2026-07-18T08:00:00Z", actor: id },
        ],
        names: { [id]: "Marta Reis" },
        loading: false,
        error: "",
        more: false,
        loadingMore: false,
      },
      presentation,
    );
    assert.ok(trail.ok, `trail ${id}`);
    assert.equal(trail.value.rows[0]?.avatar?.tone, tone, `activity actor ${id}`);

    const account = avatar(accountPerson({ userId: id, email: "marta@example.test" }));
    assert.equal(account.tone, tone, `account ${id}`);
  }
});
