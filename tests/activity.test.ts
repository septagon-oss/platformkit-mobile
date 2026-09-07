import assert from "node:assert/strict";
import test from "node:test";
import { about, since, subject, verb, type Event } from "../src/core/activity";

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
