// A rest command may declare that the server binds one of its arguments from the row the command
// runs on (`kit/rest`'s RowBindings): the vote commands on a ballot carry
// `{questionId: "questionId", ifRevision: "voteRevision"}`. A server-side screen fills those from
// the row it drew the button beside; a deck holds the same row as data. The three rules below are
// the whole of what the phone does with that declaration — read it, fill it, and refuse rather than
// send a body whose argument was guessed.
import assert from "node:assert/strict";
import test from "node:test";
import { boundArguments } from "../src/core/bindings";
import { parseCatalog, type Command, type Entry } from "../src/core/catalog";
import { personPointers } from "../src/core/derive";

/** voting is a catalogue document in the shape the kernel prints once a module declares bindings. */
function voting(): Entry {
  const catalog = parseCatalog({
    catalogVersion: 3,
    resources: [
      {
        module: "decide",
        entity: "card",
        path: "/api/v1/decide/cards",
        writable: true,
        operations: ["list", "read"],
        fields: [
          { name: "id", type: "uuid", readOnly: true },
          { name: "title", type: "string" },
          { name: "questionId", type: "uuid", readOnly: true },
          { name: "voteRevision", type: "int", readOnly: true },
          { name: "position", type: "int", readOnly: true },
          { name: "unvoted", type: "bool", readOnly: true, present: "filter" },
        ],
        commands: [
          {
            verb: "yes",
            summary: "Vote yes",
            fields: [
              { name: "questionId", type: "uuid", required: true },
              { name: "ifRevision", type: "int" },
            ],
            bindings: { questionId: "questionId", ifRevision: "voteRevision" },
          },
          { verb: "skip", summary: "Skip", fields: [], bindings: { nope: "notAField" } },
        ],
        presentation: {
          filters: [],
          deck: {
            queue: ["unvoted:true"],
            order: "position",
            directions: {
              right: { command: "yes", label: "Yes", tone: "success", icon: "check" },
            },
          },
        },
      },
      {
        module: "user",
        entity: "user",
        path: "/api/v1/user/users",
        writable: false,
        fields: [
          { name: "id", type: "uuid", readOnly: true },
          { name: "displayName", type: "string", readOnly: true },
          { name: "avatar", type: "string", readOnly: true, present: "avatar" },
        ],
      },
    ],
  });
  return catalog.resources.find((r) => r.entity === "card")!;
}

const command = (entry: Entry, verb: string): Command =>
  entry.commands.find((c) => c.verb === verb)!;

test("an entry keeps the argument pairs its command declared, and drops the one naming no field", () => {
  const entry = voting();
  assert.deepEqual(command(entry, "yes").bindings, {
    questionId: "questionId",
    ifRevision: "voteRevision",
  });
  assert.equal(command(entry, "skip").bindings, undefined);
});

test("the notice names the binding that was dropped, and the entry survives it", () => {
  const notices: string[] = [];
  parseCatalog(
    {
      catalogVersion: 3,
      resources: [
        {
          module: "decide",
          entity: "card",
          path: "/api/v1/decide/cards",
          writable: true,
          fields: [{ name: "id", type: "uuid" }],
          commands: [{ verb: "yes", summary: "Yes", bindings: { questionId: "missingField" } }],
        },
      ],
    },
    (at, why) => notices.push(`${at}: ${why}`),
  );
  assert.equal(notices.length, 1);
  assert.match(notices[0]!, /commands\[0\]\.bindings\.questionId/);
});

test("the bound arguments are filled from the row the card holds", () => {
  const yes = command(voting(), "yes");
  assert.deepEqual(
    boundArguments(yes, { id: "card-1", questionId: "question-9", voteRevision: 4 }),
    { questionId: "question-9", ifRevision: 4 },
  );
});

test("a row that cannot answer a bound argument sends nothing at all", () => {
  const yes = command(voting(), "yes");
  assert.equal(boundArguments(yes, { id: "card-1" }), undefined);
  assert.equal(boundArguments(yes, { questionId: "question-9" }), undefined);
  assert.equal(boundArguments(yes, { questionId: { nested: true }, voteRevision: 1 }), undefined);
  assert.equal(boundArguments(yes, undefined), undefined);
});

test("a command that declares no binding is sent with no body, as it always was", () => {
  assert.equal(
    boundArguments({ verb: "publish", summary: "", fields: [] }, { id: "1" }),
    undefined,
  );
});
