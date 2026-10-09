// A phone reads a refusal in its own words. The classifier decides which sentence
// a refusal is, but a decided sentence only counts once it is the one drawn, so
// this file takes every kind the table can name as the error the transport really
// throws, classifies it the way each hook does, and draws it through the real list,
// refreshed list, record and form organisms in both languages the kit holds. Two
// rules are proved at once: nothing an organism draws may read like the wire — a
// status line, the SDK's complaint about a body, a transport's own text or a
// machine code out of a problem detail — and what it draws is the sentence the
// classifier decided. Every error below carries such a wire string in its own
// message, so a screen that printed `e.message` or `e.detail` would fail the case
// it is here to prove. A field refusal is the one refusal whose server words are
// shown, and only under the field they describe; a cancellation is the one refusal
// that draws nothing at all.
import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import React from "react";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import {
  deriveCopy,
  deriveFeedback,
  failureSubject,
  formControls,
  noOrder,
  presentedTime,
  type Copy,
  type FailureContext,
  type Feedback,
  type Language,
  type Presentation,
  type Row,
} from "../../src/core/derive";
import { ApiError, ResponseError } from "../../src/effects/api";
import { refusalFields, refusalOf, type Refusal } from "../../src/screens/failure";
import { ResourceDetail } from "../../src/ui/organisms/ResourceDetail";
import { ResourceForm } from "../../src/ui/organisms/ResourceForm";
import { ResourceList } from "../../src/ui/organisms/ResourceList";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation as fixture } from "../fakes/presentation";

const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
const note = catalog.resources.find((r) => r.entity === "note")!;
const row = { id: "note-1", title: "Buy milk", status: "open", rank: 2, pinned: false, tags: [] };
const none = () => undefined;

/** The shapes of a wire string: a status line, a validator's complaint about a
 * body, a transport's own failure, or a machine code out of a problem detail. */
const wireString = /HTTP \d{3}|Invalid response at|ECONN|Network request failed|crud:/;

/** One phone per bundle the kit holds, in a zone that is not the fixture's own. */
function phone(language: Language): {
  copy: Copy;
  feedback: Feedback;
  presentation: Presentation;
} {
  const copy = deriveCopy(language);
  const where = {
    locale: language === "pt" ? "pt-PT" : "en-GB",
    timeZone: "Europe/Lisbon",
    ownZone: "Europe/Lisbon",
    now: fixture.now,
  };
  return {
    copy,
    feedback: deriveFeedback(copy, "reduced", where),
    presentation: { ...fixture, ...where, copy, weekStartsOn: 1 },
  };
}

/** The instant a refreshed list quotes when its re-read is refused — the same
 * `presentedTime` call the hook makes, so the sentence is proved with its instant. */
const lastRead = (p: Presentation): string => presentedTime(new Date(p.now), p);

const cancelled = (): Error => {
  const error = new Error("This operation was aborted");
  error.name = "AbortError";
  return error;
};

// One entry per kind the classifier can name, each as the transport's own object
// and with a message carrying a wire string: the point of the case is that this
// message never reaches the screen.
const refusals: readonly { readonly named: string; readonly error: unknown }[] = [
  { named: "a network rejection", error: new TypeError("Network request failed") },
  {
    named: "a deadline with no answer",
    error: new ApiError(0, "crud: timeout after 15000ms: ECONNREFUSED"),
  },
  {
    named: "a body this build cannot read",
    error: new ResponseError(200, "Invalid response at GET /api/v1/note/notes: expected an object"),
  },
  { named: "an expired session", error: new ApiError(401, "HTTP 401 crud: unauthenticated") },
  { named: "a plan that excludes it", error: new ApiError(402, "HTTP 402 crud: plan") },
  { named: "a caller who may not read it", error: new ApiError(403, "HTTP 403 crud: forbidden") },
  { named: "a record the server took away", error: new ApiError(404, "HTTP 404 crud: not-found") },
  {
    named: "a record someone else changed",
    error: new ApiError(409, "HTTP 409 crud: conflict: revision 7 is current"),
  },
  {
    named: "a refusal of two named fields",
    error: new ApiError(422, "HTTP 422 crud: invalid", {
      title: "is required",
      rank: "is not a number",
    }),
  },
  {
    named: "a server that failed while it worked",
    error: new ApiError(503, "HTTP 503 crud: upstream: ECONNRESET"),
  },
  { named: "a refusal with no named reason", error: new ApiError(429, "HTTP 429 crud: rate") },
  { named: "a read the screen abandoned", error: cancelled() },
];

/**
 * Each surface asks for its own reason — which is the whole of why the sentence
 * differs — and draws the refusal as its screen composition does: the list organism
 * takes only the text, the record organism takes the verdict that decides its one
 * button, and the form takes the text above the controls and the refused fields
 * under them.
 */
interface Surface {
  readonly named: string;
  readonly ask: FailureContext;
  readonly draw: (said: Refusal, p: ReturnType<typeof phone>) => React.ReactElement;
}

const list = (p: ReturnType<typeof phone>, said: Refusal, rows: readonly Row[]) => (
  <ResourceList
    presentation={p.presentation}
    entry={note}
    rows={rows}
    total={rows.length}
    loading={false}
    refreshing={false}
    more={false}
    error={said.text}
    order={noOrder}
    ordering={false}
    onOrder={none}
    onOpen={none}
    onMore={none}
    onRefresh={none}
  />
);

const surfaces: readonly Surface[] = [
  {
    named: "a list's own notice",
    ask: "read",
    draw: (said, p) => list(p, said, []),
  },
  {
    named: "a refreshed list's notice over the rows it kept",
    ask: "refresh",
    draw: (said, p) => list(p, said, [row]),
  },
  {
    named: "a record's notice, over the record that stays unless the verdict takes it",
    ask: "delete",
    draw: (said, p) => (
      <ResourceDetail
        feedback={p.feedback}
        entry={note}
        row={said.withdraws ? undefined : row}
        error={said.text}
        refusal={said.verdict}
        onRetry={none}
        onDismiss={none}
        onBack={none}
      />
    ),
  },
  {
    named: "a form's notice, above the fields a refusal coloured",
    ask: "update",
    draw: (said, p) => (
      <ResourceForm
        feedback={p.feedback}
        initialDate={new Date("2026-08-11T08:20:00Z")}
        controls={formControls(note, undefined, true)}
        held={{}}
        errors={refusalFields(said.verdict)}
        detail={said.text}
        phase="editing"
        onChange={none}
        onRetry={none}
      />
    ),
  },
];

/** A node of the rendered tree, only as far as this file reads it. A host node
 * keeps its children in its props, so both spellings are looked at. */
interface Rendered {
  readonly children?: unknown;
  readonly props?: {
    readonly children?: unknown;
    readonly accessibilityLabel?: unknown;
    readonly accessibilityValue?: unknown;
  };
}

/**
 * Every word the organisms drew: the text they show and what a screen reader is
 * told about each. Nothing else is read out of a node's props — the rest carry
 * styles, callbacks and context providers, which is where a dump of the whole tree
 * turns circular. Callers `join` with a space: a sentence is drawn in one text
 * node, and two sentences are never one.
 */
function words(node: unknown): string[] {
  if (node === null || node === undefined) return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap((child) => words(child));
  if (typeof node !== "object") return [];
  const held = node as Rendered;
  const props = held.props ?? {};
  const spoken = (value: unknown): string[] => (typeof value === "string" ? [value] : []);
  return [
    ...spoken(props.accessibilityLabel),
    ...spoken(props.accessibilityValue),
    ...words(props.children === undefined ? held.children : props.children),
  ];
}

/** One drawn screen: every word it shows or says, and whether anything announced
 * itself — both read before the screen comes down. */
async function draw(element: React.ReactElement): Promise<{
  drawn: string;
  announced: boolean;
}> {
  const view = await render(<ThemeProvider mode="light">{element}</ThemeProvider>);
  const drawn = words(view.toJSON()).join(" ");
  const announced = view.queryByRole("alert") !== null;
  await view.unmount();
  return { drawn, announced };
}

describe("the words a refusal is drawn in", () => {
  for (const language of ["en", "pt"] satisfies Language[]) {
    const p = phone(language);
    for (const { named, error } of refusals) {
      test(`${named} is drawn in the ${language.toUpperCase()} kit's own words on every surface`, async () => {
        for (const surface of surfaces) {
          const said = refusalOf(
            error,
            surface.ask,
            failureSubject(note, "", lastRead(p.presentation)),
            p.copy,
          );
          const { drawn, announced } = await draw(surface.draw(said, p));
          // Every assertion names the surface that drew the words, so a failure
          // says which screen leaked.
          expect({ [surface.named]: drawn }).toEqual({
            [surface.named]: expect.not.stringMatching(wireString),
          });
          switch (said.verdict.outcome) {
            case "silent":
              // A request the screen abandoned is not news: no notice, no alert.
              expect({ [surface.named]: announced }).toEqual({ [surface.named]: false });
              break;
            case "fields":
              // The refused fields are the only server words shown, and each is
              // shown under the control it describes — never as a sentence.
              expect(said.text).toBe("");
              for (const field of Object.values(refusalFields(said.verdict)))
                expect({ [surface.named]: drawn }).toEqual({
                  [surface.named]: expect.stringContaining(field),
                });
              break;
            default:
              expect({ [surface.named]: drawn }).toEqual({
                [surface.named]: expect.stringContaining(said.text),
              });
              expect({ [surface.named]: announced }).toEqual({ [surface.named]: true });
              break;
          }
        }
      });
    }
  }
});

// The cases above are worth only what their fixtures carry: a refusal whose own
// message holds no wire string would prove nothing against a screen that printed
// the message, so each is checked to carry one. The cancellation is the one
// refusal the transport writes for itself, and it is named as the exception.
test("every refusal drawn above carries a wire string in the server's own message", () => {
  const answered = refusals.filter(
    ({ error }) => !(error instanceof Error && error.name === "AbortError"),
  );
  expect(answered).toHaveLength(refusals.length - 1);
  for (const { named, error } of answered) {
    const wire = error instanceof ApiError ? `${error.status} ${error.detail}` : String(error);
    expect({ named, wire }).toEqual({ named, wire: expect.stringMatching(wireString) });
  }
});
