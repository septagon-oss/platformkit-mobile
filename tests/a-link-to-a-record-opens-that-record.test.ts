// One link, one reading: what a person taps in an e-mail, what another app opens, and what a
// notification carries all answer the same route, because one rule (`src/core/arrival.ts`)
// reads all three. Held against the rule and the href it composes — the route itself is
// spelled by `reentry`, which has always spelled it, so a second spelling here is the defect
// this file exists to catch.
import assert from "node:assert/strict";
import test from "node:test";
import { read as readArrival, systemHref } from "../src/core/arrival";
import { address } from "../src/core/reentry";
import type { Entry } from "../src/core/catalog";

/** The schemes this build declares: `app.config.ts`'s `scheme`, and nothing else. */
const schemes = ["platformkit"];
const href = (url: string): string | undefined => systemHref(url, schemes);

test("a scheme link naming a record answers that record's route", () => {
  assert.equal(href("platformkit://app/note/notes/7"), "/note/notes/7");
});

test("a verified-host link answers the same route", () => {
  assert.equal(href("https://platformkit.example/app/note/notes/7"), "/note/notes/7");
});

test("the host never decides, and a query or a fragment never joins the id", () => {
  for (const host of ["http://localhost:8081", "https://elsewhere.example", "https://a.b"])
    assert.equal(href(`${host}/app/note/notes/7`), "/note/notes/7");
  assert.equal(
    href("https://platformkit.example/app/note/notes/7?utm_source=x#frag"),
    "/note/notes/7",
  );
});

test("the surface alone is the start of the app", () => {
  assert.equal(href("platformkit://app"), "/");
  assert.equal(href("https://platformkit.example/app"), "/");
});

test("a resource answers its list, and a link naming nothing of ours is left alone", () => {
  assert.equal(href("platformkit://app/note/notes"), "/note/notes");
  // Not the workspace's surface: the router has always routed what it was given, and a rule
  // that answered here would steal the gallery and the command journeys from it.
  assert.equal(href("platformkit://gallery"), undefined);
  assert.equal(href("platformkit://note/notes/7"), undefined);
  // Its own surface, and a screen under a record — a sheet, a command — which no link the
  // server writes points at. The person is taken to the start rather than to nothing.
  assert.equal(href("platformkit://app/note/notes/7/run/archive"), "/");
});

test("a link from another app changes nothing", () => {
  for (const foreign of ["mailto:someone@example.com", "tel:+1234", "weird:x/y"])
    assert.equal(href(foreign), undefined);
});

test("a launch that carried no link is not a refusal of anything", () => {
  for (const nothing of [undefined, null, ""])
    assert.equal(systemHref(nothing, schemes), undefined);
});

test("a link on our own surface that names no address opens the start of the app", () => {
  for (const broken of ["platformkit://app/note", "platformkit://app/note/notes/1/2", "/app/"])
    assert.equal(href(broken), "/");
});

test("an id that arrives percent-encoded is read once and written once", () => {
  assert.equal(href("platformkit://app/note/notes/a%20b%2Fc"), "/note/notes/a%20b%2Fc");
  const noteEntry = { module: "note", entity: "notes" } as Entry;
  assert.equal(address("detail", noteEntry, "a b/c"), "/note/notes/a%20b%2Fc");
  // A percent-escape that is not one is refused by shape, and refusing is not throwing.
  assert.equal(href("platformkit://app/note/notes/%zz"), "/");
  assert.deepEqual(readArrival("platformkit://app/note/%zz", schemes), { refusal: "shape" });
});
