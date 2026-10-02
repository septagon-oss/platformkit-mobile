// A gallery page is one screen-shaped composition of the kit: a header, one
// lead block, and up to four specimens from the case vocabulary that a person
// reads as a screen rather than as a test bench. The fifteen pages are this
// literal list — no discovery, no registry — and every one of the families the
// kit owns is named by exactly one of them, which tests/gallery-pages.test.ts
// checks. A page id is public: the route, the testID and the review's --pages
// argument all read it, so it changes only with all three.
import { kitCaseIds } from "./kitGallery";
import { humanize } from "./derive";
import { type Presentation } from "./presentation";
import { build, type Validation } from "./shared";

interface PageSpec {
  readonly cases: readonly string[];
  /** lead names the block the screen opens with: the one thing the page is about. */
  readonly lead: string;
}

export const galleryPages = {
  list: {
    lead: "data-list/default",
    cases: [
      "data-list/default",
      "disclosure-section/default",
      "day-strip/default",
      "activity/default",
    ],
  },
  table: {
    lead: "stat-tile/default",
    cases: ["stat-tile/default", "sparkline/default", "price/default", "quantity-control/default"],
  },
  media: {
    lead: "media-hero/default",
    cases: [
      "media-hero/default",
      "photo-gallery/default",
      "masonry-wall/default",
      "photo-viewer/default",
    ],
  },
  home: { lead: "product-card/default", cases: ["product-card/default", "action-bar/default"] },
  sheet: {
    lead: "detail-sheet/default",
    cases: [
      "detail-sheet/default",
      "side-panel/default",
      "summary-detail/default",
      "more-filters/default",
    ],
  },
  navigate: {
    lead: "selection-control/default",
    cases: ["selection-control/default", "choice-chips/default", "action-control/default"],
  },
  search: { lead: "empty-state/filtered", cases: ["empty-state/filtered"] },
  form: {
    lead: "pricing-tiers/default",
    cases: ["pricing-tiers/default", "plan-comparison/default"],
  },
  steps: { lead: "stepper/default", cases: ["stepper/default"] },
  states: {
    lead: "skeleton/rows",
    cases: ["skeleton/rows", "spinner/default", "notice/error-immutable"],
  },
  player: { lead: "model-state/default", cases: ["model-state/default"] },
  commerce: {
    lead: "cart/default",
    cases: ["cart/default", "order-summary/default", "buy-bar/default"],
  },
  schedule: {
    lead: "calendar/default",
    cases: [
      "calendar/default",
      "week-calendar/default",
      "agenda-list/default",
      "slot-picker/default",
    ],
  },
  maps: { lead: "map-with-list/default", cases: ["map-with-list/default", "map-legend/default"] },
  charts: { lead: "area-chart/default", cases: ["area-chart/default", "bar-chart/default"] },
} as const satisfies Record<string, PageSpec>;

export type GalleryPageId = keyof typeof galleryPages;

export const galleryPageIds = Object.keys(galleryPages) as readonly GalleryPageId[];

/** A page's family is what its specimen's id says it is: the part before the state. */
export const pageFamily = (caseId: string): string => caseId.split("/")[0] ?? caseId;

export function deriveGalleryPage(id: string, _p: Presentation) {
  return build(_p, (v: Validation) => {
    const spec = galleryPages[id as GalleryPageId];
    // An unknown page id refuses rather than render the sign-in form by
    // accident, which is what a silent route fallback would show a reviewer.
    v.need(spec !== undefined, "page");
    v.need(spec.cases.length > 0 && spec.cases.length <= 4, "cases");
    spec.cases.forEach((caseId, i) => {
      v.need((kitCaseIds as readonly string[]).includes(caseId), `cases.${i}`);
    });
    return {
      id,
      title: humanize(id),
      lead: spec.lead,
      cases: spec.cases as readonly string[],
      testID: `gallery-page:${id}`,
    };
  });
}
export type GalleryPageModel = Extract<ReturnType<typeof deriveGalleryPage>, { ok: true }>["value"];
