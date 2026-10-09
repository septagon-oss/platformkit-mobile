// The classification table is the specification: every kind, in every context,
// answers with one copy key, one IssueCode, one action and one answer about
// whether the record stays on the screen. The table below is that specification as
// data, and every case in this file is one row of it — so a change to a sentence's
// meaning is a change here, and a change to the classifier alone cannot pass.
import assert from "node:assert/strict";
import { test } from "node:test";
import { copyLanguage, deriveCopy } from "../src/core/copy";
import { deriveState } from "../src/core/feedback";
import {
  classifyFailure,
  failureKind,
  noFields,
  refusalAction,
  withdraws,
  type FailureAction,
  type FailureContext,
  type FailureFacts,
  type FailureKeeps,
  type FailureKind,
  type FailureSubject,
} from "../src/core/failure";
import { deriveFeedback, type IssueCode } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

const subject: FailureSubject = {
  singular: "task",
  plural: "tasks",
  command: "Close the loop",
  lastSeen: "18 Jul 2026, 09:00",
};

// Each `shape` is the transport's own, so the row pins the fact and not a
// re-imagining of it: a transport rejection is not an ApiError, a deadline is one
// with status 0, a cancellation is an AbortError, and an unreadable body carries
// the status it arrived with.
const shapes: Record<string, FailureFacts> = {
  "the network rejected the request": {
    cancelled: false,
    answered: false,
    status: 0,
    unreadable: false,
    fields: noFields,
  },
  "the server did not answer within the deadline": {
    cancelled: false,
    answered: false,
    status: 0,
    unreadable: false,
    fields: noFields,
  },
  "the screen left before the answer": {
    cancelled: true,
    answered: false,
    status: 0,
    unreadable: false,
    fields: noFields,
  },
  "a body this build cannot read": {
    cancelled: false,
    answered: true,
    status: 200,
    unreadable: true,
    fields: noFields,
  },
  "a catalogue newer than this build": {
    cancelled: false,
    answered: true,
    status: 200,
    unreadable: true,
    fields: noFields,
  },
  signed: { cancelled: false, answered: true, status: 401, unreadable: false, fields: noFields },
  plan: { cancelled: false, answered: true, status: 402, unreadable: false, fields: noFields },
  forbidden: { cancelled: false, answered: true, status: 403, unreadable: false, fields: noFields },
  missing: { cancelled: false, answered: true, status: 404, unreadable: false, fields: noFields },
  conflict: { cancelled: false, answered: true, status: 409, unreadable: false, fields: noFields },
  "field issues": {
    cancelled: false,
    answered: true,
    status: 422,
    unreadable: false,
    fields: { title: "a note needs a title" },
  },
  "no field named": {
    cancelled: false,
    answered: true,
    status: 422,
    unreadable: false,
    fields: noFields,
  },
  unavailable: {
    cancelled: false,
    answered: true,
    status: 503,
    unreadable: false,
    fields: noFields,
  },
  "refused elsewhere": {
    cancelled: false,
    answered: true,
    status: 429,
    unreadable: false,
    fields: noFields,
  },
};

const contexts: readonly FailureContext[] = [
  "read",
  "refresh",
  "create",
  "update",
  "delete",
  "command",
  "catalog",
];

/** Every context answers the same way: silence, the plan line, a notice per cell. */
const every = (make: (context: FailureContext) => Expect): Record<string, Expect> =>
  Object.fromEntries(contexts.map((c) => [c, make(c)]));

const keepsContent: readonly FailureContext[] = [
  "refresh",
  "create",
  "update",
  "delete",
  "command",
];

type Expect = {
  readonly outcome: "silent" | "notice" | "plan" | "fields";
  readonly key?: string;
  readonly code?: IssueCode;
  readonly action?: FailureAction;
  readonly retains?: FailureKeeps;
};

// kind x context. Silence is a cancellation; `plan` is not a refusal of this
// person's action; `fields` colours a control and says nothing above it.
const table: Readonly<Record<FailureKind, Readonly<Record<string, Expect>>>> = {
  cancelled: every(() => ({ outcome: "silent" })),
  connection: {
    read: {
      outcome: "notice",
      key: "connection",
      code: "unavailable",
      action: "retry",
      retains: "gone",
    },
    refresh: {
      outcome: "notice",
      key: "refreshFailed",
      code: "unavailable",
      action: "retry",
      retains: "content",
    },
    create: {
      outcome: "notice",
      key: "uncertain",
      code: "write-unknown",
      action: "dismiss",
      retains: "content",
    },
    update: {
      outcome: "notice",
      key: "uncertain",
      code: "write-unknown",
      action: "reconcile",
      retains: "content",
    },
    delete: {
      outcome: "notice",
      key: "uncertain",
      code: "write-unknown",
      action: "reconcile",
      retains: "content",
    },
    command: {
      outcome: "notice",
      key: "uncertain",
      code: "write-unknown",
      action: "dismiss",
      retains: "content",
    },
    catalog: {
      outcome: "notice",
      key: "connection",
      code: "unavailable",
      action: "retry",
      retains: "gone",
    },
  },
  unsupported: {
    read: {
      outcome: "notice",
      key: "update",
      code: "unsupported-format",
      action: "none",
      retains: "gone",
    },
    refresh: {
      outcome: "notice",
      key: "update",
      code: "unsupported-format",
      action: "none",
      retains: "gone",
    },
    create: {
      outcome: "notice",
      key: "uncertain",
      code: "write-unknown",
      action: "dismiss",
      retains: "content",
    },
    update: {
      outcome: "notice",
      key: "uncertain",
      code: "write-unknown",
      action: "reconcile",
      retains: "content",
    },
    delete: {
      outcome: "notice",
      key: "uncertain",
      code: "write-unknown",
      action: "reconcile",
      retains: "content",
    },
    command: {
      outcome: "notice",
      key: "uncertain",
      code: "write-unknown",
      action: "dismiss",
      retains: "content",
    },
    catalog: {
      outcome: "notice",
      key: "update",
      code: "unsupported-format",
      action: "none",
      retains: "gone",
    },
  },
  "signed-out": {
    read: {
      outcome: "notice",
      key: "signedOut",
      code: "unavailable",
      action: "none",
      retains: "gone",
    },
    refresh: {
      outcome: "notice",
      key: "signedOut",
      code: "unavailable",
      action: "none",
      retains: "gone",
    },
    create: {
      outcome: "notice",
      key: "signedOut",
      code: "unavailable",
      action: "none",
      retains: "content",
    },
    update: {
      outcome: "notice",
      key: "signedOut",
      code: "unavailable",
      action: "none",
      retains: "content",
    },
    delete: {
      outcome: "notice",
      key: "signedOut",
      code: "unavailable",
      action: "none",
      retains: "content",
    },
    command: {
      outcome: "notice",
      key: "signedOut",
      code: "unavailable",
      action: "none",
      retains: "content",
    },
    catalog: {
      outcome: "notice",
      key: "signedOut",
      code: "unavailable",
      action: "none",
      retains: "gone",
    },
  },
  // The plan arm carries the sentence, not a key: the notice is drawn as the
  // quiet line the activity section already draws, never as a refusal.
  plan: every((c) => ({
    outcome: "plan",
    retains: keepsContent.includes(c) ? "content" : "gone",
  })),
  access: {
    read: {
      outcome: "notice",
      key: "noAccess",
      code: "forbidden",
      action: "back",
      retains: "gone",
    },
    refresh: {
      outcome: "notice",
      key: "noAccess",
      code: "forbidden",
      action: "back",
      retains: "gone",
    },
    create: {
      outcome: "notice",
      key: "noAccess",
      code: "forbidden",
      action: "dismiss",
      retains: "content",
    },
    update: {
      outcome: "notice",
      key: "noAccess",
      code: "forbidden",
      action: "dismiss",
      retains: "content",
    },
    delete: {
      outcome: "notice",
      key: "noAccess",
      code: "forbidden",
      action: "dismiss",
      retains: "content",
    },
    command: {
      outcome: "notice",
      key: "noAccess",
      code: "forbidden",
      action: "dismiss",
      retains: "content",
    },
    catalog: {
      outcome: "notice",
      key: "noAccess",
      code: "forbidden",
      action: "none",
      retains: "gone",
    },
  },
  missing: {
    read: { outcome: "notice", key: "gone", code: "not-found", action: "back", retains: "gone" },
    refresh: { outcome: "notice", key: "gone", code: "not-found", action: "back", retains: "gone" },
    create: {
      outcome: "notice",
      key: "gone",
      code: "not-found",
      action: "dismiss",
      retains: "content",
    },
    update: {
      outcome: "notice",
      key: "gone",
      code: "not-found",
      action: "dismiss",
      retains: "content",
    },
    delete: {
      outcome: "notice",
      key: "gone",
      code: "not-found",
      action: "dismiss",
      retains: "content",
    },
    command: {
      outcome: "notice",
      key: "gone",
      code: "not-found",
      action: "dismiss",
      retains: "content",
    },
    catalog: { outcome: "notice", key: "gone", code: "not-found", action: "none", retains: "gone" },
  },
  revision: {
    read: {
      outcome: "notice",
      key: "loadFailed",
      code: "read-failed",
      action: "retry",
      retains: "gone",
    },
    refresh: {
      outcome: "notice",
      key: "refreshFailed",
      code: "read-failed",
      action: "retry",
      retains: "content",
    },
    create: {
      outcome: "notice",
      key: "revision",
      code: "conflict",
      action: "dismiss",
      retains: "content",
    },
    update: {
      outcome: "notice",
      key: "revision",
      code: "conflict",
      action: "dismiss",
      retains: "content",
    },
    delete: {
      outcome: "notice",
      key: "deleteFailed",
      code: "conflict",
      action: "retry",
      retains: "content",
    },
    command: {
      outcome: "notice",
      key: "commandFailed",
      code: "conflict",
      action: "retry",
      retains: "content",
    },
    catalog: {
      outcome: "notice",
      key: "loadCatalog",
      code: "unavailable",
      action: "retry",
      retains: "gone",
    },
  },
  "field-issues": {
    read: {
      outcome: "notice",
      key: "loadFailed",
      code: "read-failed",
      action: "retry",
      retains: "gone",
    },
    refresh: {
      outcome: "notice",
      key: "refreshFailed",
      code: "read-failed",
      action: "retry",
      retains: "content",
    },
    create: { outcome: "fields" },
    update: { outcome: "fields" },
    delete: {
      outcome: "notice",
      key: "deleteFailed",
      code: "validation",
      action: "retry",
      retains: "content",
    },
    command: { outcome: "fields" },
    catalog: {
      outcome: "notice",
      key: "loadCatalog",
      code: "unavailable",
      action: "retry",
      retains: "gone",
    },
  },
  server: {
    read: {
      outcome: "notice",
      key: "loadFailed",
      code: "read-failed",
      action: "retry",
      retains: "gone",
    },
    refresh: {
      outcome: "notice",
      key: "refreshFailed",
      code: "read-failed",
      action: "retry",
      retains: "content",
    },
    create: {
      outcome: "notice",
      key: "saveFailed",
      code: "unavailable",
      action: "retry",
      retains: "content",
    },
    update: {
      outcome: "notice",
      key: "saveFailed",
      code: "unavailable",
      action: "retry",
      retains: "content",
    },
    delete: {
      outcome: "notice",
      key: "deleteFailed",
      code: "unavailable",
      action: "retry",
      retains: "content",
    },
    command: {
      outcome: "notice",
      key: "commandFailed",
      code: "unavailable",
      action: "retry",
      retains: "content",
    },
    catalog: {
      outcome: "notice",
      key: "loadCatalog",
      code: "unavailable",
      action: "retry",
      retains: "gone",
    },
  },
  refused: {
    read: {
      outcome: "notice",
      key: "loadFailed",
      code: "read-failed",
      action: "retry",
      retains: "gone",
    },
    refresh: {
      outcome: "notice",
      key: "refreshFailed",
      code: "read-failed",
      action: "retry",
      retains: "content",
    },
    create: {
      outcome: "notice",
      key: "saveFailed",
      code: "unavailable",
      action: "retry",
      retains: "content",
    },
    update: {
      outcome: "notice",
      key: "saveFailed",
      code: "unavailable",
      action: "retry",
      retains: "content",
    },
    delete: {
      outcome: "notice",
      key: "deleteFailed",
      code: "unavailable",
      action: "retry",
      retains: "content",
    },
    command: {
      outcome: "notice",
      key: "commandFailed",
      code: "unavailable",
      action: "retry",
      retains: "content",
    },
    catalog: {
      outcome: "notice",
      key: "loadCatalog",
      code: "unavailable",
      action: "retry",
      retains: "gone",
    },
  },
};

// Which shape produces which kind. `unsupported` arrives at this build twice — a
// body of its own and a catalogue it cannot read — and both are the same sentence.
const producers: Readonly<Record<FailureKind, readonly string[]>> = {
  cancelled: ["the screen left before the answer"],
  connection: ["the network rejected the request", "the server did not answer within the deadline"],
  unsupported: ["a body this build cannot read", "a catalogue newer than this build"],
  "signed-out": ["signed"],
  plan: ["plan"],
  access: ["forbidden"],
  missing: ["missing"],
  revision: ["conflict"],
  "field-issues": ["field issues"],
  server: ["unavailable"],
  refused: ["no field named", "refused elsewhere"],
};

const banned = /HTTP \d{3}|Invalid response at|ECONN|Network request failed|crud:/;

for (const kind of Object.keys(producers) as FailureKind[]) {
  for (const context of contexts) {
    const expect = table[kind][context];
    for (const shape of producers[kind]) {
      test(`a ${kind} during a ${context} is drawn from ${shape}`, () => {
        const facts = shapes[shape]!;
        assert.equal(failureKind(facts), kind, "which rule fires is the precedence");
        const verdict = classifyFailure(facts, context, subject, deriveCopy("en"));
        assert.equal(verdict.outcome, expect.outcome);
        if (expect.outcome === "silent") {
          assert.equal(withdraws(verdict), false, "a request the screen left withdraws nothing");
          return;
        }
        assert.equal(
          "key" in verdict ? verdict.key : "",
          expect.key ?? "",
          "the copy key the sentence comes from",
        );
        if ("retains" in verdict) assert.equal(verdict.retains, expect.retains);
        assert.equal(withdraws(verdict), expect.retains === "gone");
        if (expect.outcome === "fields") {
          assert.deepEqual(verdict.fields, shapes[shape]!.fields);
          return;
        }
        assert.ok(verdict.text.length > 0, "a notice always says something");
        if (verdict.outcome !== "notice") return;
        assert.equal(verdict.code, expect.code);
        assert.equal(verdict.action, expect.action);
        assert.equal(
          verdict.fields === shapes[shape]!.fields,
          true,
          "the fields travel with the verdict untouched",
        );
      });
    }
  }
}

test("every sentence the table can name is held in both languages and quotes no wire string", () => {
  for (const kind of Object.keys(producers) as FailureKind[]) {
    for (const context of contexts) {
      for (const language of ["en", "pt"] as const) {
        const verdict = classifyFailure(
          shapes[producers[kind]![0]!]!,
          context,
          subject,
          deriveCopy(language),
        );
        if (verdict.outcome === "silent" || verdict.outcome === "fields") continue;
        assert.ok(verdict.text.trim().length > 0, `${kind}/${context}/${language} is empty`);
        assert.equal(
          banned.test(verdict.text),
          false,
          `${kind}/${context}/${language} reads "${verdict.text}"`,
        );
      }
    }
  }
});

test("deriveState draws every pair the table can emit", () => {
  const p = deriveFeedback(deriveCopy("en"), "reduced", presentation);
  for (const kind of Object.keys(producers) as FailureKind[]) {
    for (const context of contexts) {
      const verdict = classifyFailure(
        shapes[producers[kind]![0]!]!,
        context,
        subject,
        deriveCopy("en"),
      );
      if (verdict.outcome !== "notice") continue;
      const intent =
        verdict.action === "retry"
          ? ("retry-read" as const)
          : verdict.action === "back"
            ? ("next" as const)
            : verdict.action === "reconcile"
              ? ("reconcile" as const)
              : ("dismiss" as const);
      const result = deriveState(
        {
          kind: "error",
          issue: {
            code: verdict.code,
            path: context,
            recovery: ["forbidden", "not-found", "unsupported-format"].includes(verdict.code)
              ? "immutable"
              : "correctable",
            message: verdict.text,
          },
          ...(verdict.action === "none"
            ? {}
            : {
                action: {
                  intent,
                  control: {
                    id: "state",
                    label: verdict.action,
                    tone: "plain" as const,
                    state: "ready" as const,
                  },
                },
              }),
        },
        p,
      );
      assert.equal(
        result.ok,
        true,
        `${kind}/${context} refused: ${result.ok ? "" : result.issues.map((i) => `${i.path}:${i.code}`).join(",")}`,
      );
    }
  }
});

test("an immutable refusal and an unanswered write refuse the actions they must", () => {
  const p = deriveFeedback(deriveCopy("en"), "reduced", presentation);
  const refused: readonly [IssueCode, "retry-read"][] = [
    ["write-unknown", "retry-read"],
    ["forbidden", "retry-read"],
    ["not-found", "retry-read"],
    ["unsupported-format", "retry-read"],
  ];
  for (const [code, intent] of refused) {
    const result = deriveState(
      {
        kind: "error",
        issue: {
          code,
          path: "x",
          recovery: code === "write-unknown" ? "correctable" : "immutable",
          message: "a sentence",
        },
        action: {
          intent,
          control: { id: "state", label: "Again", tone: "plain", state: "ready" },
        },
      },
      p,
    );
    assert.equal(result.ok, false, `${code} would have offered ${intent}`);
  }
});

test("a refusal names one button, and an unanswered write never names Retry", () => {
  const copy = deriveCopy("en");
  const doors = { retry: () => {}, reconcile: () => {}, dismiss: () => {}, back: () => {} };
  const said = (kind: FailureKind, context: FailureContext) =>
    refusalAction(
      classifyFailure(shapes[producers[kind]![0]!]!, context, subject, copy),
      copy,
      doors,
      subject,
    );
  assert.equal(said("cancelled", "read"), undefined);
  assert.equal(said("field-issues", "update"), undefined);
  assert.equal(said("signed-out", "read"), undefined);
  assert.equal(said("unsupported", "read"), undefined);
  assert.deepEqual(said("connection", "read"), { label: "Retry", onPress: doors.retry });
  assert.deepEqual(said("connection", "update"), {
    label: "Check the result",
    onPress: doors.reconcile,
  });
  assert.deepEqual(said("access", "read"), { label: "Back to tasks", onPress: doors.back });
  assert.deepEqual(said("access", "update"), { label: "Dismiss", onPress: doors.dismiss });
  // The law, stated as an assertion: no context that sent a write offers a retry
  // when nothing answered it.
  for (const context of ["create", "update", "delete", "command"] as FailureContext[])
    assert.notEqual(
      refusalAction(
        classifyFailure(shapes["the network rejected the request"]!, context, subject, copy),
        copy,
        doors,
        subject,
      )?.label,
      copy.state.retry,
      `${context} would replay a write nobody answered`,
    );
});

test("the words follow the phone, and every other tag falls back to English", () => {
  assert.equal(copyLanguage("pt-BR"), "pt");
  assert.equal(copyLanguage("pt_PT"), "pt");
  assert.equal(copyLanguage("PT"), "pt");
  assert.equal(copyLanguage("en-GB"), "en");
  assert.equal(copyLanguage("fr-FR"), "en");
  assert.equal(copyLanguage(""), "en");
  assert.equal(copyLanguage(undefined), "en");
  assert.equal(
    deriveCopy(copyLanguage("pt-BR")).failure.noAccess,
    "Já não tem acesso a este item.",
  );
});
