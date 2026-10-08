// A 401 from the password leg means two different things and the phone has to
// tell them apart without a server that says which: an account that also answers
// with a second factor, and a password that is simply wrong. src/core/signInOutcome
// .ts decides that from the problem's type when the document names one, and from
// the kernel's exact sentence while it does not — this file is the gate under that
// fallback. It reads the pinned document rather than restating it: the day
// auth-login's 401 arrives with a type of its own, the sentence stops being a rule
// and becomes a liability, and the case that goes red says so by name.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { expiredCredential, factorRequired } from "../src/core/signInOutcome";

const document = JSON.parse(readFileSync("testdata/openapi.json", "utf8")) as {
  paths: Record<string, Record<string, Record<string, unknown>>>;
  components: { schemas: Record<string, Record<string, unknown>> };
};

/** resolve follows the one `$ref` shape a document of this generation uses. */
function resolve(schema: Record<string, unknown>): Record<string, unknown> {
  const ref = schema.$ref;
  if (typeof ref !== "string") return schema;
  const name = ref.split("/").pop()!;
  const target = document.components.schemas[name];
  assert.ok(target, `${ref} names no schema in the pinned document`);
  return target as Record<string, unknown>;
}

/** typeValues are the answers the document says a refused sign-in's problem may
 * carry in its `type` member: any enum, const, default or example it prints. An
 * empty list means the document says nothing, which is what leaves the sentence
 * as the only discriminator the phone has. */
function typeValues(): unknown[] {
  const responses = document.paths["/api/v1/auth/login"]?.["post"]?.responses as Record<
    string,
    | Record<string, Record<string, { schema?: Record<string, unknown> } | undefined> | undefined>
    | undefined
  >;
  const media = responses?.["401"]?.content?.["application/problem+json"];
  assert.ok(media, "auth-login's 401 answers no content type at all");
  const problem = resolve(media.schema ?? {});
  const properties = (problem.properties ?? {}) as Record<string, Record<string, unknown>>;
  const type = properties["type"];
  assert.ok(type, "the problem this document answers with carries no type member");
  const named: unknown[] = [];
  for (const key of ["enum", "const", "default", "examples", "example"] as const) {
    const value = type[key];
    if (value === undefined) continue;
    named.push(...(Array.isArray(value) ? value : [value]));
  }
  return named;
}

test("the pinned document still says nothing about which type a refused sign-in carries", () => {
  const named = typeValues();
  // about:blank is what kit/problem gives every problem whose status says it
  // all, and the urn is what the phone would match if the kernel grew one:
  // naming either in the document proves nothing new. Anything else — the
  // kernel's own urn for the factor — means the exact-sentence fallback in
  // src/core/signInOutcome.ts must go, together with this case.
  assert.deepEqual(
    named.filter(
      (value) => value !== "about:blank" && value !== "urn:platformkit:auth:factor-required",
    ),
    [],
    "auth-login's 401 now names a problem type: delete factorRequired's sentence fallback and match this type alone",
  );
});

test("a factor challenge is told from a wrong password by what the answer carries", () => {
  const sentence = "that password is right; this account also answers with a second factor";
  const urn = "urn:platformkit:auth:factor-required";
  assert.equal(factorRequired({ status: 401, detail: sentence }), true);
  assert.equal(factorRequired({ status: 401, type: "about:blank", detail: sentence }), true);
  assert.equal(factorRequired({ status: 401, type: urn, detail: "said differently" }), true);
  // The same 401 with any other sentence is a wrong password, and any other
  // type that is not the urn says the answer is about something else entirely.
  assert.equal(
    factorRequired({ status: 401, type: "about:blank", detail: "wrong password" }),
    false,
  );
  assert.equal(
    factorRequired({ status: 401, type: "urn:platformkit:auth:rate-limited", detail: sentence }),
    false,
  );
  assert.equal(factorRequired({ status: 403, type: "about:blank", detail: sentence }), false);
  assert.equal(factorRequired({ status: 503, detail: sentence }), false);
});

test("a dead key is an expired credential; a price and a permission are not", () => {
  assert.equal(expiredCredential({ status: 401, detail: "token revoked" }), true);
  assert.equal(expiredCredential({ status: 402, detail: "the plan does not include this" }), false);
  assert.equal(expiredCredential({ status: 403, detail: "you may not read that" }), false);
  assert.equal(expiredCredential({ status: 401, detail: 7 }), false);
  assert.equal(expiredCredential(null), false);
  assert.equal(expiredCredential(new Error("network unreachable")), false);
});
