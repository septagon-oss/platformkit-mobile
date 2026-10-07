// A gallery page is one screen-shaped composition of the kit: a display line,
// one lead specimen, and the family sections beside it. The fifteen pages are
// this literal list — no discovery, no registry — and every family the kit owns
// is the specimen of exactly one of them, which tests/gallery-pages.test.ts
// checks against kitCaseIds. Case ids are copied from that vocabulary by hand:
// a page that names an id the kit does not have refuses at boot rather than
// render a blank screen to whoever came to look. A page id is public: the route,
// the testID and a review's --pages argument all read it, so it changes only
// with all three.
import { kitCaseIds } from "./kitGallery";
import { humanize } from "./derive";
import { type Presentation } from "./presentation";
import { build, type Validation } from "./shared";

interface PageSpec {
  readonly cases: readonly string[];
  /** lead names the specimen the screen opens with: the one thing the page is about. */
  readonly lead: string;
  /** withLead names what the lead is a control *over*. A field with nothing beside
   * it is a promise; the thing it produced belongs to the same screen, so the fold
   * shows both and the states of either open beneath. */
  readonly withLead?: readonly string[];
}

export const galleryPages = {
  list: {
    lead: "data-list/grouped",
    cases: [
      "data-list/grouped",
      "data-list/loading",
      "data-list/error",
      "day-strip/current",
      "disclosure-section/default",
      "activity/before-after",
    ],
  },
  // A table page is a table first: named columns over rows of records, with the
  // figures in a column of their own. The tiles and the sparkline are what a
  // table's cells are made of, so they read beside it rather than standing in
  // for it — which is what left this page with no columns and no rows.
  table: {
    lead: "data-table/populated",
    cases: [
      "data-table/populated",
      "data-table/absent-figure",
      "stat-tile/lower-is-better",
      "sparkline/rising",
      "price/fraction",
      "quantity-control/middle",
    ],
  },
  media: {
    lead: "media-hero/default",
    cases: [
      "media-hero/default",
      "media-hero/loading",
      "media-hero/error",
      "photo-gallery/mixed-ratios",
      "photo-viewer/middle",
    ],
  },
  home: {
    lead: "product-card/options",
    cases: [
      "product-card/options",
      "product-card/sold-out",
      "product-card/loading",
      "action-bar/multiple",
    ],
  },
  sheet: {
    lead: "detail-sheet/open",
    cases: [
      "detail-sheet/open",
      "detail-sheet/dirty",
      "side-panel/docked",
      "more-filters/open",
      "confirm-dialog/delete",
    ],
  },
  navigate: {
    lead: "tab-bar/three",
    withLead: ["summary-detail/default"],
    cases: [
      "tab-bar/three",
      "tab-bar/five",
      "tab-bar/unavailable",
      "action-control/default",
      "action-control/busy",
      "summary-detail/default",
    ],
  },
  // A search is a field over what it found: the field the person is typing in
  // leads, the wall of matches follows it at once, and the field's other states
  // come last under their own family name rather than stacked above the results.
  search: {
    lead: "search-field/query",
    withLead: ["masonry-wall/two-columns"],
    cases: [
      "search-field/query",
      "masonry-wall/two-columns",
      "search-field/busy",
      "search-field/clear",
    ],
  },
  form: {
    lead: "pricing-tiers/default",
    cases: [
      "pricing-tiers/default",
      "pricing-tiers/missing-offer",
      "plan-comparison/unknown",
      "selection-control/mixed",
      "choice-chips/selected",
      "choice-chips/required",
    ],
  },
  steps: {
    lead: "stepper/middle",
    // The stage's own subject is drawn inside the stepper, above the verbs that
    // move past it, so the slot examples stand beside the page as the family's
    // other states rather than as a second screen below the stage's actions.
    cases: [
      "stepper/middle",
      "stepper/first",
      "stepper/write-unknown",
      "slot-option/available",
      "slot-option/full",
    ],
  },
  // A state is met by doing something about it, so the screen opens on the one
  // state a person can act on — a collection with nothing in it and the verb that
  // fills it — and the measures, which say how far something has come, follow.
  states: {
    lead: "model-state/empty",
    cases: [
      "model-state/empty",
      "model-state/loading",
      "progress-meter/fraction",
      "progress-meter/percent",
      "progress-meter/unmeasured",
    ],
  },
  player: {
    lead: "mini-player/track",
    cases: ["mini-player/track", "mini-player/live"],
  },
  commerce: {
    lead: "cart/multiple-lines",
    cases: [
      "cart/multiple-lines",
      "cart/quote-expired",
      "order-summary/receipt",
      "buy-bar/default",
    ],
  },
  // A schedule opens on the day that is selected and what happens in it. The
  // date control chooses another day; the week and its hourly grid are wider
  // views of the same week, so they follow rather than lead the screen.
  schedule: {
    lead: "agenda-list/range",
    cases: [
      "agenda-list/range",
      "slot-picker/date-strip",
      "calendar/week",
      "week-calendar/overlap",
    ],
  },
  maps: {
    lead: "map-with-list/points",
    cases: ["map-with-list/points", "map-with-list/same-coordinate", "map-legend/default"],
  },
  charts: {
    lead: "area-chart/multiple-series",
    cases: ["area-chart/multiple-series", "bar-chart/negative"],
  },
} as const satisfies Record<string, PageSpec>;

export type GalleryPageId = keyof typeof galleryPages;

export const galleryPageIds = Object.keys(galleryPages) as readonly GalleryPageId[];

/** A page's family is what its specimen's id says it is: the part before the state. */
export const pageFamily = (caseId: string): string => caseId.split("/")[0] ?? caseId;

/** The heading a specimen's own surface writes for itself, family by family. Most
 * specimens take their heading from the records they draw — a list is titled by what
 * it holds, a plan comparison by the plan it compares — so the page's family line is
 * the only heading above them. One family's specimen titles itself from the kit's own
 * words, read from the same bundle the page would read. */
const specimenHeading: Readonly<Record<string, (p: Presentation) => string>> = {
  activity: (p) => p.copy.kit.activity,
};

/** The line the page draws above a group of specimens: the family's name, unless the
 * one specimen under it already writes those words for itself. A heading is read as a
 * heading twice over by anyone who navigates a screen by them, so the page keeps out
 * of the way where the specimen names itself. A group of more than one specimen is
 * still named: that line says what the examples below it share. */
export function groupHeading(
  group: { readonly id: string; readonly cases: readonly string[] },
  p: Presentation,
): string | undefined {
  const family = humanize(group.id);
  const own = specimenHeading[group.id]?.(p);
  return group.cases.length === 1 && own === family ? undefined : family;
}

export function deriveGalleryPage(id: string, _p: Presentation) {
  return build(_p, (v: Validation) => {
    const spec = (galleryPages as Record<string, PageSpec | undefined>)[id];
    // An unknown page id refuses rather than render the sign-in form by
    // accident, which is what a silent route fallback would show a reviewer.
    v.need(spec !== undefined, "page");
    const cases = spec!.cases;
    // A page is a screen, and a screen carries its subject and the states of it:
    // four specimens left a page's fold half empty on a phone.
    v.need(cases.length > 0 && cases.length <= 6, "cases");
    v.need(cases.includes(spec!.lead), "lead");
    cases.forEach((caseId, i) => {
      // The vocabulary is the kit's, so a page cannot invent a specimen and a
      // renamed case fails here instead of showing an empty section.
      v.need((kitCaseIds as readonly string[]).includes(caseId), `cases.${i}`);
    });
    const withLead = spec!.withLead ?? [];
    // What is drawn with the lead is drawn because the lead is a control over it,
    // so it cannot also be one of the states held behind the page's disclosure.
    v.need(
      withLead.every((caseId) => cases.includes(caseId) && caseId !== spec!.lead),
      "withLead",
    );
    return {
      id,
      title: humanize(id),
      lead: spec!.lead,
      withLead,
      cases: cases as readonly string[],
      testID: `gallery-page:${id}`,
    };
  });
}
export type GalleryPageModel = Extract<ReturnType<typeof deriveGalleryPage>, { ok: true }>["value"];
