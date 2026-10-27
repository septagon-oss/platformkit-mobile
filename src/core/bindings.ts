// bindings.ts fills the command arguments a server binds from the row the command runs on.
//
// An entry may declare `bindings: {questionId: "questionId"}` on a command: the body member
// `questionId` carries that row's `questionId`, and the same for `ifRevision` against the row's
// own revision. A server-side screen draws its button beside the row, so it can fill them without
// being told; a phone's deck holds the same row as data, so it fills them the same way. Both are
// saying one thing — "this command runs on this row, and these are that row's values" — and this
// is the single place that reads the pair off the declaration.
//
// A row that carries no value for one of the names answers nothing at all rather than a half
// body: a command whose argument was guessed is a command a person cannot tell was guessed, and
// a stale expected revision is exactly the argument the server refuses on the caller's behalf.
import type { Command } from "./catalog";
import type { Row } from "./record";

/**
 * boundArguments returns the body a command's bound arguments give it, or nothing when there are
 * none to send. A command with no declaration is sent as it always was, with no body; a command
 * that declares bindings but meets a row without one of those values, or with a value no wire
 * scalar can carry, is not sent at all.
 */
export function boundArguments(
  command: Command,
  row: Row | undefined,
): Record<string, unknown> | undefined {
  const pairs = Object.entries(command.bindings ?? {});
  if (pairs.length === 0) return undefined;
  const body: Record<string, unknown> = {};
  for (const [argument, field] of pairs) {
    const value = row?.[field];
    if (value === undefined || value === null || typeof value === "object") return undefined;
    body[argument] = value;
  }
  return body;
}
