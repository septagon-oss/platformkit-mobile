// What a phone's destinations are: a bar of two to five places, each with the
// badge it carries, and a search field that says what the query narrowed to.
// The ceilings are the pattern's, so the refusals are the interesting cases.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy } from "../src/core/copy";
import { badgeText, deriveSearch, deriveTabs } from "../src/core/navigation";
import type { Presentation } from "../src/core/presentation";

const english: Presentation = {
  copy: deriveCopy("en"),
  locale: "en-GB",
  timeZone: "UTC",
  now: "2026-08-14T12:00:00Z",
  weekStartsOn: 1,
  motion: "reduced",
};
const portuguese: Presentation = { ...english, copy: deriveCopy("pt"), locale: "pt-PT" };

const ready = <T>(result: { ok: true; value: T } | { ok: false; issues: unknown }): T => {
  assert.ok(result.ok, "the model was refused");
  return result.value;
};
const refused = (
  result: { ok: true; value: unknown } | { ok: false; issues: readonly { path: string }[] },
  path: string,
): void => {
  assert.ok(!result.ok, "the model was accepted");
  assert.ok(
    (result as { ok: false; issues: readonly { path: string }[] }).issues.some(
      (i) => i.path === path,
    ),
    `expected a refusal naming ${path}`,
  );
};

const three = [
  { id: "today", label: "Today" },
  { id: "search", label: "Search" },
  { id: "you", label: "You" },
];

test("a bar names each destination, which one is standing and what it carries", () => {
  const tabs = ready(
    deriveTabs(
      {
        tabs: [{ ...three[0]!, badge: 4 }, three[1]!, { ...three[2]!, badge: 128 }],
        selected: "search",
      },
      english,
    ),
  );
  assert.deepEqual(
    tabs.items.map((item) => [item.id, item.selected, item.badge]),
    [
      ["today", false, "4"],
      ["search", true, undefined],
      ["you", false, "99+"],
    ],
  );
  assert.equal(tabs.label, english.copy.kit.navigate);
});

test("a hundred and nine new items is a crowd, not a number", () => {
  assert.equal(badgeText(109, english), "99+");
  assert.equal(badgeText(99, english), "99");
  assert.equal(badgeText(100, english), "99+");
  assert.equal(badgeText(0, english), "0");
});

test("a destination that cannot be opened keeps the reason it stays for", () => {
  const tabs = ready(
    deriveTabs(
      {
        tabs: [three[0]!, { ...three[1]!, unavailable: "Ask an owner for access" }, three[2]!],
        selected: "today",
      },
      english,
    ),
  );
  assert.deepEqual(
    tabs.items.map((item) => item.unavailable),
    [undefined, "Ask an owner for access", undefined],
  );
  refused(
    deriveTabs(
      { tabs: [{ ...three[0]!, unavailable: "" }, three[1]!], selected: "today" },
      english,
    ),
    "tabs.0.unavailable",
  );
});

test("a bar refuses one destination and six", () => {
  refused(deriveTabs({ tabs: [three[0]!], selected: three[0]!.id }, english), "tabs");
  refused(
    deriveTabs(
      {
        tabs: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, label: `T${i}` })),
        selected: "t0",
      },
      english,
    ),
    "tabs",
  );
});

test("a bar refuses a duplicate id, an empty label and a selection it does not hold", () => {
  refused(
    deriveTabs(
      {
        tabs: [
          { id: "a", label: "A" },
          { id: "a", label: "Other" },
        ],
        selected: "a",
      },
      english,
    ),
    "tabs.1.id",
  );
  refused(
    deriveTabs(
      {
        tabs: [
          { id: "a", label: "  " },
          { id: "b", label: "B" },
        ],
        selected: "a",
      },
      english,
    ),
    "tabs.0.label",
  );
  refused(
    deriveTabs(
      {
        tabs: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        selected: "c",
      },
      english,
    ),
    "selected",
  );
});

test("a badge that is not a count is refused where it is", () => {
  refused(
    deriveTabs(
      {
        tabs: [
          { id: "a", label: "A", badge: -1 },
          { id: "b", label: "B" },
        ],
        selected: "a",
      },
      english,
    ),
    "tabs.0.badge",
  );
  refused(
    deriveTabs(
      {
        tabs: [
          { id: "a", label: "A", badge: 1.5 },
          { id: "b", label: "B" },
        ],
        selected: "a",
      },
      english,
    ),
    "tabs.0.badge",
  );
});

test("a search field prints the count it narrowed to, in the language of the screen", () => {
  const search = ready(deriveSearch({ value: "que", placeholder: "Songs", count: 12 }, english));
  assert.equal(search.countText, `12 ${english.copy.kit.results}`);
  assert.equal(search.narrowed, true);
  assert.equal(
    ready(deriveSearch({ value: "que", placeholder: "Músicas", count: 12 }, portuguese)).countText,
    `12 ${portuguese.copy.kit.results}`,
  );
  // Zero is a result the person needs to see, not the absence of one.
  assert.equal(
    ready(deriveSearch({ value: "zzz", placeholder: "Songs", count: 0 }, english)).countText,
    `0 ${english.copy.kit.results}`,
  );
});

test("a field with no count says nothing about one", () => {
  const search = ready(deriveSearch({ value: "", placeholder: "Songs" }, english));
  assert.equal(search.countText, undefined);
  assert.equal(search.busy, false);
  assert.equal(search.narrowed, false);
  assert.equal(search.label, english.copy.kit.search);
  assert.equal(search.clearLabel, english.copy.kit.clearSearch);
  assert.equal(search.cancelLabel, english.copy.kit.cancelSearch);
});

test("a search refuses a count it could not have counted and a placeholder nobody reads", () => {
  refused(deriveSearch({ value: "", placeholder: "Songs", count: -3 }, english), "count");
  refused(deriveSearch({ value: "", placeholder: "Songs", count: 2.5 }, english), "count");
  refused(deriveSearch({ value: "", placeholder: "   " }, english), "placeholder");
});

test("typing is what makes a query in force when the caller does not say", () => {
  assert.equal(
    ready(deriveSearch({ value: "  a  ", placeholder: "Songs" }, english)).narrowed,
    true,
  );
  assert.equal(
    ready(deriveSearch({ value: "", placeholder: "Songs", narrowed: true }, english)).narrowed,
    true,
  );
});
