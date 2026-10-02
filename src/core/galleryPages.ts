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
  table: {
    lead: "stat-tile/lower-is-better",
    cases: [
      "stat-tile/lower-is-better",
      "stat-tile/zero-baseline",
      "sparkline/rising",
      "sparkline/gap",
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
    cases: [
      "tab-bar/three",
      "tab-bar/five",
      "action-control/default",
      "action-control/busy",
      "summary-detail/default",
    ],
  },
  // A search is a field over what it found: the field answers in three states,
  // and the wall below it is what the kit draws for the matches it returned.
  search: {
    lead: "search-field/query",
    cases: [
      "search-field/query",
      "search-field/busy",
      "search-field/clear",
      "masonry-wall/two-columns",
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
    cases: [
      "stepper/middle",
      "stepper/first",
      "stepper/write-unknown",
      "slot-option/available",
      "slot-option/full",
    ],
  },
  states: {
    lead: "progress-meter/fraction",
    cases: [
      "progress-meter/fraction",
      "progress-meter/percent",
      "progress-meter/steps",
      "progress-meter/unmeasured",
      "model-state/loading",
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
  schedule: {
    lead: "calendar/week",
    cases: [
      "calendar/week",
      "week-calendar/overlap",
      "agenda-list/range",
      "slot-picker/date-strip",
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
    return {
      id,
      title: humanize(id),
      lead: spec!.lead,
      cases: cases as readonly string[],
      testID: `gallery-page:${id}`,
    };
  });
}
export type GalleryPageModel = Extract<ReturnType<typeof deriveGalleryPage>, { ok: true }>["value"];
