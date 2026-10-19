// One connection document is read as three things: what the place is called, what colour it
// wears and what mark it hands out. The name a person may paint comes only in the one
// spelling the workspace's own document names for it, and a mark only as a path on the host
// that named it — the phone never follows a URL a server points it at, and never paints a
// colour it cannot read.
import assert from "node:assert/strict";
import test from "node:test";
import type { Connection } from "../src/generated/types.gen";
import {
  ACCENT,
  WORKSPACES_KEEP,
  WORKSPACES_SHOWN,
  rememberedFrom,
  rememberedStamp,
  unknownWorkspace,
  workspaceMarkURI,
  workspaceOf,
  workspaceServer,
} from "../src/core/workspace";

const answer = {
  accent: "#2563EB",
  accentRatio: { light: 4.5, dark: 3.55 },
  methods: { oidc: false, passkey: true, password: true, saml: false },
  name: "  Acme Works  ",
  recovery: { available: true },
  revision: 4,
  signIn: { address: "/api/v1/auth/login" },
  theme: "system",
} as const satisfies Connection;

/** marked is the same answer with a mark named: the one field this suite takes away and puts back. */
const marked = {
  ...answer,
  logoUrl: "/api/v1/public/file/files/0199mark",
} as const satisfies Connection;
const MARK = "/api/v1/public/file/files/0199mark";

test("an answered document becomes one workspace: name trimmed, colour lower-cased, mark kept", () => {
  assert.deepEqual(workspaceOf(marked, "https://acme.test"), {
    host: "acme.test",
    name: "Acme Works",
    accent: "#2563eb",
    logoPath: MARK,
  });
});

test("the same host with and without a trailing slash is one workspace", () => {
  assert.deepEqual(
    workspaceOf(answer, "https://acme.test/"),
    workspaceOf(answer, "https://acme.test"),
  );
  assert.equal(workspaceServer("https://acme.test///"), workspaceServer("https://acme.test"));
});

test("an empty accent says nobody chose one; the name and the mark are worn all the same", () => {
  const face = workspaceOf({ ...marked, accent: "" }, "https://acme.test");
  assert.equal(face.accent, undefined);
  assert.equal(face.name, "Acme Works");
  assert.equal(face.logoPath, MARK);
});

test("an accent in any other spelling is refused by name and never guessed at", () => {
  for (const accent of ["#fff", "rgb(37,99,235)", "2563eb", "#2563ez", "  "]) {
    assert.equal(workspaceOf({ ...answer, accent }, "https://acme.test").accent, undefined, accent);
  }
  assert.ok(ACCENT.test("#2563EB") && ACCENT.test("#0F5D4E"));
});

test("a workspace whose name is only spaces has no name, which is what sends a screen to the host", () => {
  assert.equal(workspaceOf({ ...answer, name: "   " }, "https://acme.test").name, "");
  assert.deepEqual(unknownWorkspace("https://acme.test"), { host: "acme.test", name: "" });
  assert.deepEqual(unknownWorkspace("not an address"), { host: "", name: "" });
});

test("a mark is a path on the host that named it, and nothing else", () => {
  for (const logoUrl of [
    "https://elsewhere.test/mark.png",
    "//elsewhere.test/mark.png",
    "mark.png",
    "",
  ]) {
    assert.equal(
      workspaceOf({ ...answer, logoUrl }, "https://acme.test").logoPath,
      undefined,
      logoUrl,
    );
  }
  assert.equal(workspaceOf(answer, "https://acme.test").logoPath, undefined);
  assert.equal(
    workspaceMarkURI("https://acme.test", "/api/v1/mark"),
    "https://acme.test/api/v1/mark",
  );
  assert.equal(workspaceMarkURI("https://acme.test", undefined), "");
});

test("a remembered row names the server, its own name and the moment; a credential has nowhere to go", () => {
  const row = rememberedStamp(
    workspaceOf(marked, "https://acme.test/"),
    "https://acme.test/",
    "2026-10-19T12:00:00Z",
  );
  assert.deepEqual(row, {
    host: "https://acme.test",
    name: "Acme Works",
    logoPath: MARK,
    seenAt: "2026-10-19T12:00:00Z",
  });
  assert.deepEqual(Object.keys(rememberedFrom(row)).sort(), ["host", "logoPath", "name", "seenAt"]);
});

test("an address that answered nothing, and a name nobody can read, are never remembered", () => {
  assert.equal(
    rememberedStamp(unknownWorkspace("https://acme.test"), "https://acme.test", "t"),
    undefined,
  );
  assert.equal(rememberedStamp(workspaceOf(answer, "https://acme.test"), "", "t"), undefined);
  assert.equal(
    rememberedStamp({ host: "acme.test", name: "  " }, "https://acme.test", "t"),
    undefined,
  );
});

test("the bounds are the ones the connect step draws within", () => {
  assert.ok(WORKSPACES_SHOWN <= WORKSPACES_KEEP);
  assert.equal(WORKSPACES_SHOWN, 5);
  assert.equal(WORKSPACES_KEEP, 8);
});
