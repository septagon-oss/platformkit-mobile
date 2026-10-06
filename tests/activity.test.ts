// What a trail shows is derived from events the server owns: an event belongs to a record when its
// id appears anywhere in the payload, its name's last segment is the verb a person reads, its module
// and entity name the subject, and "how long ago" picks the coarsest unit that is still true. A
// session denial withdraws a trail before it is validated or formatted — rows, actor names, the
// paging control and any page error go, in both languages, and the caller's draft is left as held.
import assert from "node:assert/strict";
import test from "node:test";
import { about, since, subject, verb, type Event } from "../src/core/activity";
import { deriveCopy, deriveEventActivity } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

const at = "2026-09-07T10:00:00Z";
const event = (name: string, payload: unknown): Event => ({
  id: "e1",
  name,
  occurredAt: at,
  payload,
});

test("an event is about a record when its id is anywhere in the payload", () => {
  const id = "9f1c0f6e-0000-4000-8000-000000000001";
  // A generated write carries the row, so the id is `id`.
  assert.equal(about(event("task.task.updated", { id, title: "Buy milk" }), id), true);
  // A command carries its own payload, where the id is named for the entity.
  assert.equal(about(event("task.task.assigned", { taskId: id, to: "someone" }), id), true);
  // Nested and in a list count too, which is what makes this shape-agnostic.
  assert.equal(about(event("x.y.z", { changes: [{ record: { id } }] }), id), true);
  assert.equal(about(event("task.task.updated", { id: "another" }), id), false);
  assert.equal(about(event("task.task.updated", { id }), ""), false);
  assert.equal(about({ id: "e1", name: "n", occurredAt: at }, id), false);
});

test("a verb is the last segment of the name, as a person reads it", () => {
  assert.equal(verb(event("task.task.created", {})), "Created");
  assert.equal(verb(event("content.content.published", {})), "Published");
  assert.equal(verb(event("user.user.password_set", {})), "Password set");
  // A name that follows no convention still reads as itself.
  assert.equal(verb(event("something", {})), "Something");
});

test("a subject is the module and entity an event is about", () => {
  assert.equal(subject(event("task.task.created", {})), "task/task");
  assert.equal(subject(event("beep", {})), "beep");
});

test("how long ago is the coarsest unit that is still true, and a date past a week", () => {
  const now = new Date("2026-09-07T12:00:00Z");
  const ago = (ms: number) => since(new Date(now.getTime() - ms), now, () => "a date");
  assert.equal(ago(5_000), "just now");
  assert.equal(ago(60_000), "a minute ago");
  assert.equal(ago(5 * 60_000), "5 minutes ago");
  assert.equal(ago(60 * 60_000), "an hour ago");
  assert.equal(ago(3 * 60 * 60_000), "3 hours ago");
  assert.equal(ago(25 * 60 * 60_000), "yesterday");
  assert.equal(ago(3 * 24 * 60 * 60_000), "3 days ago");
  assert.equal(ago(8 * 24 * 60 * 60_000), "a date");
  // A clock that is behind the server's is a date, not a negative count.
  assert.equal(
    since(new Date(now.getTime() + 60_000), now, () => "a date"),
    "a date",
  );
});

for (const language of ["en", "pt"] as const) {
  test(`${language} generated activity gives session denial precedence over cached rows and paging`, () => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const trail = {
      events: [{ ...event("note.note.updated", { id: "note-14" }), actor: "actor-6" }],
      names: { "actor-6": "Cached actor six" },
      error: "",
      loading: true,
      loadingMore: true,
      more: true,
      denied: true,
    };
    const result = deriveEventActivity(trail, p);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value.rows, []);
    assert.equal(result.value.more, undefined);
    assert.equal(result.value.pageError, undefined);
    assert.equal(result.value.writable, false);
    assert.equal(result.value.state?.kind, "error");
    assert.equal(result.value.state?.body, p.copy.kit.unavailable);
    assert.deepEqual(result.value.state?.actions, []);
    assert.equal(JSON.stringify(result.value).includes("Cached actor six"), false);
    assert.equal(trail.events.length, 1);
    assert.equal(Object.isFrozen(trail.events), false);

    const recovered = deriveEventActivity(
      { ...trail, denied: false, loading: false, loadingMore: false },
      p,
    );
    assert.equal(recovered.ok, true);
    if (recovered.ok) {
      assert.equal(recovered.value.rows[0]!.actor, "Cached actor six");
      assert.equal(recovered.value.more?.enabled, true);
    }
  });

  test(`${language} denial withdraws a cached trail before validating or formatting it`, () => {
    const p = { ...presentation, copy: deriveCopy(language) };
    // The cached row is unreadable on its own terms: a withdrawn trail must not
    // be re-derived into a validation refusal, because that would describe the
    // caller's own cache as readable data they never got to see.
    const cached = {
      events: [
        {
          ...event("note.note.updated", { id: "note-203" }),
          occurredAt: "not-an-instant",
          actor: "actor-203",
        },
      ],
      names: { "actor-203": "Withdrawn actor" },
      loading: true,
      loadingMore: true,
      more: true,
      error: "",
      denied: true,
    };
    const before = JSON.stringify(cached);
    const result = deriveEventActivity(cached, p);
    assert.equal(result.ok, true, "withdrawn cached data is not a new readable snapshot");
    if (!result.ok) return;
    assert.deepEqual(result.value.rows, []);
    assert.equal(result.value.more, undefined);
    assert.equal(result.value.pageError, undefined);
    assert.equal(result.value.state?.body, p.copy.kit.unavailable);
    assert.deepEqual(result.value.state?.actions, []);
    assert.equal(JSON.stringify(result.value).includes("Withdrawn actor"), false);
    assert.equal(JSON.stringify(cached), before);
    assert.equal(Object.isFrozen(cached.events[0]), false);

    // The same row without the denial is the caller's readable data, and its
    // timestamp still has to be one.
    const malformed = deriveEventActivity({ ...cached, denied: false }, p);
    assert.equal(malformed.ok, false, "readable timestamps still require validation");
    assert.equal("value" in malformed, false);

    // Only explicit new input makes history readable again: the snapshot already
    // returned stays detached after the caller edits its own draft.
    cached.events[0]!.occurredAt = "2026-08-04T11:00:00Z";
    cached.names["actor-203"] = "Fresh actor";
    const recovered = deriveEventActivity(
      { ...cached, denied: false, loading: false, loadingMore: false },
      p,
    );
    assert.equal(recovered.ok, true);
    if (recovered.ok) assert.equal(recovered.value.rows[0]?.actor, "Fresh actor");
    assert.deepEqual(result.value.rows, []);
    assert.equal(result.value.state?.body, p.copy.kit.unavailable);
  });
}
