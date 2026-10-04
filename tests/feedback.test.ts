import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCopy,
  deriveState,
  display,
  instantValue,
  readPhase,
  stateExamples,
  type Presentation,
  type StateAction,
  type StateInput,
} from "../src/core/derive";

const p: Presentation = {
  copy: deriveCopy("en"),
  locale: "en-GB",
  timeZone: "UTC",
  now: "2026-08-14T12:00:00Z",
  weekStartsOn: 1,
  motion: "reduced",
};
const read: StateAction = {
  intent: "retry-read",
  control: { id: "reload", label: "Read again", state: "ready", tone: "primary" },
};

test("C02: immutable and unknown writes refuse retry intents, including secondary controls", () => {
  for (const [code, recovery] of [
    ["forbidden", "immutable"],
    ["not-found", "immutable"],
    ["write-unknown", "correctable"],
  ] as const) {
    const result = deriveState(
      {
        kind: "error",
        issue: { code, recovery, path: "record", message: "Cannot continue." },
        secondary: read,
      },
      p,
    );
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("expected refusal");
    assert.deepEqual(result.issues, [
      {
        code: "invalid-input",
        path: "secondary.intent",
        recovery: "immutable",
        message: "This information is not valid.",
      },
    ]);
    assert.equal("value" in result, false);
  }
  const write: StateInput = {
    kind: "error",
    issue: { code: "write-unknown", recovery: "correctable", path: "save", message: "Timeout" },
    action: { ...read, intent: "reconcile" },
  };
  const result = deriveState(write, p);
  assert.ok(result.ok);
  assert.equal(result.value.actions[0]?.intent, "reconcile");
  assert.match(result.value.body, /may have been saved/);
  assert.equal(deriveState({ ...write, action: { ...read, intent: "next" } }, p).ok, false);

  // The refusal is written in the caller's copy, not in an English default, and
  // a valid dismissal intent on the same draft is accepted.
  const pt = { ...p, copy: deriveCopy("pt"), locale: "pt-BR" };
  const translated: StateInput = {
    kind: "error",
    issue: {
      code: "write-unknown",
      path: "submit",
      recovery: "correctable",
      message: "O resultado ainda não é conhecido.",
    },
    action: {
      intent: "reconcile",
      control: { id: "lookup", label: "Consultar", state: "ready", tone: "primary" },
    },
    secondary: {
      intent: "next",
      control: { id: "submit-again", label: "Enviar", state: "ready", tone: "plain" },
    },
  };
  const original = JSON.stringify(translated);
  const refusal = deriveState(translated, pt);
  assert.equal(refusal.ok, false);
  assert.equal("value" in refusal, false);
  if (!refusal.ok)
    assert.deepEqual(refusal.issues, [
      {
        code: "invalid-input",
        path: "secondary.intent",
        recovery: "immutable",
        message: "Esta informação não é válida.",
      },
    ]);
  assert.equal(JSON.stringify(translated), original);
  assert.equal(
    deriveState({ ...translated, secondary: { ...translated.secondary!, intent: "dismiss" } }, pt)
      .ok,
    true,
  );
});

test("state derivation rejects contradictory controls without changing caller data", () => {
  const input: StateInput = {
    kind: "empty",
    action: read,
    secondary: { ...read, control: { ...read.control, state: "disabled" } },
  };
  const before = JSON.stringify(input);
  const result = deriveState(input, p);
  assert.ok(!result.ok);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    ["secondary.control.id", "secondary.control.reason", "secondary.control.tone"],
  );
  assert.equal(JSON.stringify(input), before);
  assert.equal(deriveState({ kind: "empty", title: " " }, p).ok, false);
});

test("C03: busy keeps the action label; an absent action stays absent", () => {
  const result = deriveState(
    { kind: "empty", action: { ...read, control: { ...read.control, state: "busy" } } },
    p,
  );
  assert.ok(result.ok);
  assert.equal(result.value.component, "empty");
  assert.equal(result.value.actions[0]?.label, "Read again");
  assert.equal(result.value.actions[0]?.disabled, true);
  assert.equal(result.value.actions[0]?.busy, true);
  const passive = deriveState({ kind: "success" }, p);
  assert.ok(passive.ok);
  assert.deepEqual(passive.value.actions, []);
  assert.equal(passive.value.announcement, "polite");
  assert.equal(passive.value.icon, "check");
});

test("C01: copy, locale and zone are explicit and independent between callers", () => {
  const input: StateInput = { kind: "offline", updatedAt: "2026-08-13T23:40:00Z" };
  const english = deriveState(input, p);
  const portuguese = deriveState(input, {
    ...p,
    copy: deriveCopy("pt"),
    locale: "pt-PT",
    timeZone: "Europe/Lisbon",
  });
  assert.ok(english.ok && portuguese.ok);
  assert.equal(english.value.title, "You are offline");
  assert.equal(portuguese.value.title, "Está sem ligação");
  assert.match(english.value.updatedAt!, /13 Aug 2026.*23:40/);
  assert.match(portuguese.value.updatedAt!, /14.*08.*2026.*00:40/);
  deriveState(input, { ...p, locale: "pt-BR", timeZone: "America/Sao_Paulo" });
  assert.deepEqual(deriveState(input, p), english);
  assert.equal(portuguese.value.title, "Está sem ligação");
  assert.equal(Object.isFrozen(deriveCopy("pt").state), true);
  const portugueseActions = deriveState(input, {
    ...p,
    copy: deriveCopy("pt"),
    locale: "pt-BR",
    timeZone: "Pacific/Honolulu",
  });
  assert.ok(portugueseActions.ok);
  assert.ok(Object.isFrozen(portugueseActions.value.actions));
  // The whole nested tree has to exist in both languages: a key missing from one
  // copy renders an empty control in that language and nowhere else.
  const paths = (value: object, prefix = ""): string[] =>
    Object.entries(value).flatMap(([key, child]) => {
      const path = `${prefix}${key}`;
      return child !== null && typeof child === "object" ? paths(child, `${path}.`) : [path];
    });
  assert.deepEqual(paths(deriveCopy("pt")), paths(deriveCopy("en")));
});

test("unsupported formatting refuses instead of falling back to the device", () => {
  for (const patch of [
    { locale: "xx-ZZ" },
    { locale: "not_a_locale" },
    { timeZone: "Missing/Zone" },
    { timeZone: "" },
  ]) {
    const result = deriveState({ kind: "empty" }, { ...p, ...patch });
    assert.ok(!result.ok);
    assert.equal(result.issues[0]?.code, "unsupported-format");
  }
});

test("value formatting shares the explicit locale and copy with state messages", () => {
  const portuguese = { ...p, copy: deriveCopy("pt"), locale: "pt-BR" };
  assert.equal(display({ name: "active", type: "bool" }, true, portuguese), "Sim");
  assert.equal(display({ name: "total", type: "float" }, 2457.5, portuguese), "2.457,5");
  assert.equal(display({ name: "total", type: "float" }, 2457.5, p), "2,457.5");
  assert.equal(display({ name: "sample", type: "float" }, 1e-21, p), "0.000000000000000000001");
  assert.throws(() => deriveCopy("unsupported" as never), /unsupported-format/);
});

test("stale timestamps require real UTC/offset instants with millisecond precision", () => {
  assert.equal(
    instantValue("2024-02-29T23:18:42.125+02:30")?.toISOString(),
    "2024-02-29T20:48:42.125Z",
  );
  for (const at of [
    "2026-02-29T10:00:00Z",
    "2026-04-31T10:00:00Z",
    "2026-01-31T24:00:00Z",
    "2026-01-31T09:00:60Z",
    "2026-01-31T09:00:00",
    "2026-01-31T09:00:00.1234Z",
    "2026-01-31T09:00:00+24:00",
  ])
    assert.equal(instantValue(at), undefined, at);
  const result = deriveState({ kind: "offline", updatedAt: "2026-09-31T09:00:00Z" }, p);
  assert.ok(!result.ok);
  assert.equal(result.issues[0]?.path, "updatedAt");
});

test("a forbidden record cannot be described as stale readable content", () => {
  const result = deriveState(
    {
      kind: "error",
      updatedAt: "2026-08-12T00:00:00Z",
      issue: { code: "forbidden", recovery: "immutable", path: "record", message: "No access." },
    },
    p,
  );
  assert.ok(!result.ok);
  assert.equal(result.issues[0]?.path, "updatedAt");
});

test("C03: a failed first read is not an empty result; refresh retains rows", () => {
  assert.equal(readPhase(false, 0, "No connection"), "error");
  assert.equal(readPhase(true, 0, "No connection"), "error");
  assert.equal(readPhase(true, 0, ""), "loading");
  assert.equal(readPhase(false, 0, ""), "empty");
  assert.equal(readPhase(false, 7, "No connection"), "ready");
});

test("the literal gallery derives every example in EN/PT and all required formatting locales", () => {
  for (const language of ["en", "pt"] as const)
    for (const locale of ["en-GB", "pt-PT", "pt-BR"]) {
      const result = stateExamples({ ...p, copy: deriveCopy(language), locale });
      assert.ok(result.ok);
      assert.equal(result.value.length, 31);
      assert.equal(new Set(result.value.map((example) => example.id)).size, 31);
      assert.ok(result.value.every((example) => example.model.language === language));
    }
});
