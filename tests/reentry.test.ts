// The rule behind coming back in, asked directly: which identity a session is
// bound to, when two of them are the same person, and what address each of the
// four screens spells. The shell holds the answer to all three; this file is
// where the answer itself is pinned, so a failure above says which half broke.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { address, samePerson, who } from "../src/core/reentry";

const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
const note = catalog.resources.find((r) => r.entity === "note")!;
const setting = catalog.resources.find((r) => r.entity === "setting")!;

test("a session is bound to the server that made it and the user id it named", () => {
  assert.equal(who("https://acme.test", "user-1"), "https://acme.test|user-1");
  assert.equal(who("http://localhost:8081", "user-1"), "http://localhost:8081|user-1");
  // The origin, not the string: the same server with a path after it is the same server.
  assert.equal(who("https://acme.test/api/v1", "user-1"), who("https://acme.test", "user-1"));
  // Another server is another identity, even for one user id and one email.
  assert.notEqual(who("https://other.test", "user-1"), who("https://acme.test", "user-1"));
  // And another user is another person on one server.
  assert.notEqual(who("https://acme.test", "user-2"), who("https://acme.test", "user-1"));
});

test("a session the server never identified has no identity to inherit", () => {
  assert.equal(who("https://acme.test", undefined), undefined);
  assert.equal(who("https://acme.test", ""), undefined);
  assert.equal(who("", "user-1"), undefined);
  assert.equal(who("not a server", "user-1"), undefined);
});

test("same person means both sides can say who they are, and say the same", () => {
  const a = who("https://acme.test", "user-1");
  assert.equal(samePerson(a, who("https://acme.test", "user-1")), true);
  assert.equal(samePerson(a, who("https://acme.test", "user-2")), false);
  assert.equal(samePerson(a, who("https://other.test", "user-1")), false);
  // Unknown on either side is never "the same": an unknown session never takes
  // over what a known one left behind, and does not lose it to nobody either.
  assert.equal(samePerson(a, undefined), false);
  assert.equal(samePerson(undefined, a), false);
  assert.equal(samePerson(undefined, undefined), false);
});

test("each screen spells its own address, at the row and at the collection", () => {
  assert.equal(address("list", note), "/note/note");
  assert.equal(address("detail", note, "1"), "/note/note/1");
  assert.equal(address("form", note), "/note/note/new");
  assert.equal(address("form", note, "1"), "/note/note/1/edit");
  assert.equal(address("command", note, "1", "archive"), "/note/note/1/run/archive");
  // A command the collection runs has no row in its address at all.
  assert.equal(address("command", note, undefined, "export"), "/note/note/run/export");
  // A singleton's list route is the record itself: one door, not three.
  assert.equal(address("list", setting), "/note/setting");
  // The router's own encoding, so two spellings of one row are one address.
  assert.equal(address("detail", note, "a b"), "/note/note/a%20b");
});
