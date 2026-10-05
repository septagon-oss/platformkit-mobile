import type { Action } from "./feedback";
import type { Presentation } from "./presentation";
import {
  action,
  build,
  content,
  issue,
  pageControl,
  type Content,
  type Page,
  type Validation,
} from "./shared";
export interface MediaItem {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly description: string;
  readonly caption?: string;
  readonly decorative: boolean;
  readonly state: "loading" | "ready" | "error" | "unavailable";
  readonly reason?: string;
}
export interface MediaInput {
  readonly content: Content<readonly MediaItem[]>;
  readonly selectedId?: string;
  readonly page: Page;
}
export interface ImageSlotProps {
  readonly id: string;
  readonly description: string;
  readonly decorative: boolean;
  readonly fit: "cover" | "contain";
  readonly aspectRatio: number;
}
function mediaItem(item: MediaItem, v: Validation) {
  v.text(item.id, "item.id");
  v.need(
    Number.isSafeInteger(item.width) &&
      item.width > 0 &&
      Number.isSafeInteger(item.height) &&
      item.height > 0,
    "item.dimensions",
  );
  if (!item.decorative) v.text(item.description, "item.description");
  v.need(["loading", "ready", "error", "unavailable"].includes(item.state), "item.state");
  return {
    ...item,
    aspectRatio: item.width / item.height,
    canOpen: !item.decorative && item.state === "ready",
    canRetry: item.state === "error" || item.state === "unavailable",
    reason:
      item.state === "error" || item.state === "unavailable"
        ? (item.reason ?? v.p.copy.kit.imageUnavailable)
        : undefined,
    loadingLabel: v.p.copy.state.loading,
    retryLabel: v.p.copy.kit.retryImage,
    motion: v.p.motion,
  };
}
export type MediaItemModel = ReturnType<typeof mediaItem>;
export function deriveMedia(input: MediaInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const base = content(input.content, v);
    const items = input.content.phase === "ready" ? input.content.value : [];
    v.ids(items, "items");
    const models = items.map((item) => ({
      ...mediaItem(item, v),
      selected: item.id === input.selectedId,
    }));
    return {
      ...base,
      title: p.copy.kit.images,
      items: models,
      more: pageControl(input.page, v, input.content.phase === "ready"),
      pageError: input.page.error,
      selectionIssue:
        input.selectedId && !models.some((item) => item.id === input.selectedId && item.canOpen)
          ? issue(p, "selectedId", "unavailable")
          : undefined,
    };
  });
}
export type MediaModel = Extract<ReturnType<typeof deriveMedia>, { ok: true }>["value"];
export function deriveMediaHero(
  input: {
    readonly item: MediaItem;
    readonly title?: string;
    readonly subtitle?: string;
    readonly action?: Action;
  },
  p: Presentation,
) {
  return build(p, (v: Validation) => ({
    item: mediaItem(input.item, v),
    title: input.title,
    subtitle: input.subtitle,
    action: input.action ? action(input.action, v, "action") : undefined,
  }));
}
export type MediaHeroModel = Extract<ReturnType<typeof deriveMediaHero>, { ok: true }>["value"];
export function deriveViewer(input: MediaInput & { readonly open: boolean }, p: Presentation) {
  return build(p, (v: Validation) => {
    const media = v.take(deriveMedia(input, p));
    const index = media.items.findIndex((item) => item.id === input.selectedId && !item.decorative);
    const selected = media.items[index];
    const eligible = media.items.filter((item) => !item.decorative);
    const at = eligible.findIndex((item) => item.id === input.selectedId);
    return {
      ...media,
      open: input.open,
      selected,
      // An open viewer retains the item's load/recovery lifecycle; canOpen
      // only governs opening a ready thumbnail from a collection.
      selectionIssue: input.open && !selected ? issue(p, "selectedId", "unavailable") : undefined,
      position: selected ? `${index + 1} ${p.copy.kit.of} ${media.items.length}` : undefined,
      previous: at > 0 ? eligible[at - 1]!.id : undefined,
      next: at >= 0 && at < eligible.length - 1 ? eligible[at + 1]!.id : undefined,
      labels: {
        previous: p.copy.kit.previous,
        next: p.copy.kit.next,
        close: p.copy.kit.close,
        zoomIn: p.copy.kit.zoomIn,
        zoomOut: p.copy.kit.zoomOut,
        reset: p.copy.kit.reset,
        panLeft: p.copy.kit.panLeft,
        panRight: p.copy.kit.panRight,
        panUp: p.copy.kit.panUp,
        panDown: p.copy.kit.panDown,
      },
      motion: p.motion,
    };
  });
}
export type ViewerModel = Extract<ReturnType<typeof deriveViewer>, { ok: true }>["value"];

// A specimen's artwork is derived, not stored. A screen that has a picture of its
// own supplies a renderer and this is never asked for; what a gallery of the kit's
// own components can own is a composition — one poster per specimen id, the same
// poster on every screen and every run, taken from a handful of hand-set layouts
// rather than scattered at random, and named in colour roles so the palette stays
// in one file (src/ui/theme.tsx). Nothing here stands in for a picture that
// failed to load: that case says so (item.reason) and offers a retry.
export interface PosterMark {
  readonly id: string;
  /** tone is which colour role fills the mark, named for its job in the palette. */
  readonly tone: "accent" | "ink" | "sheet";
  readonly shape: "disc" | "band";
  /** left, top and width are fractions of the slot's width; a band's height is a fraction of its height, a disc is a square. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height?: number;
}
export interface Poster {
  readonly layout: string;
  readonly marks: readonly PosterMark[];
}
const LAYOUTS: readonly { readonly layout: string; readonly marks: readonly PosterMark[] }[] = [
  {
    layout: "moonrise",
    marks: [
      { id: "disc", tone: "accent", shape: "disc", left: 0.55, top: 0.1, width: 0.36 },
      {
        id: "sheet",
        tone: "sheet",
        shape: "band",
        left: 0.08,
        top: 0.62,
        width: 0.84,
        height: 0.16,
      },
      { id: "rule", tone: "ink", shape: "band", left: 0.08, top: 0.84, width: 0.44, height: 0.07 },
    ],
  },
  {
    layout: "ledger",
    marks: [
      { id: "ink", tone: "ink", shape: "band", left: 0.1, top: 0.14, width: 0.8, height: 0.09 },
      {
        id: "accent",
        tone: "accent",
        shape: "band",
        left: 0.1,
        top: 0.31,
        width: 0.54,
        height: 0.09,
      },
      { id: "sheet", tone: "sheet", shape: "band", left: 0.1, top: 0.48, width: 0.7, height: 0.09 },
      { id: "disc", tone: "accent", shape: "disc", left: 0.6, top: 0.66, width: 0.26 },
    ],
  },
  {
    layout: "sheet-and-dot",
    marks: [
      { id: "sheet", tone: "sheet", shape: "disc", left: 0.08, top: 0.08, width: 0.54 },
      { id: "accent", tone: "accent", shape: "disc", left: 0.56, top: 0.5, width: 0.34 },
      { id: "rule", tone: "ink", shape: "band", left: 0.08, top: 0.86, width: 0.4, height: 0.06 },
    ],
  },
  {
    layout: "rising",
    marks: [
      { id: "one", tone: "ink", shape: "disc", left: 0.1, top: 0.62, width: 0.22 },
      { id: "two", tone: "accent", shape: "disc", left: 0.38, top: 0.38, width: 0.28 },
      { id: "three", tone: "sheet", shape: "disc", left: 0.68, top: 0.12, width: 0.24 },
    ],
  },
  {
    layout: "eclipse",
    marks: [
      { id: "accent", tone: "accent", shape: "disc", left: 0.16, top: 0.22, width: 0.5 },
      { id: "sheet", tone: "sheet", shape: "disc", left: 0.44, top: 0.38, width: 0.46 },
      { id: "rule", tone: "ink", shape: "band", left: 0.16, top: 0.82, width: 0.68, height: 0.06 },
    ],
  },
  {
    layout: "horizon",
    marks: [
      { id: "ground", tone: "ink", shape: "band", left: 0, top: 0.66, width: 1, height: 0.34 },
      { id: "disc", tone: "accent", shape: "disc", left: 0.3, top: 0.16, width: 0.3 },
      { id: "sheet", tone: "sheet", shape: "band", left: 0.08, top: 0.74, width: 0.5, height: 0.1 },
    ],
  },
];

// FNV-1a: a few arithmetic steps, no dependency, and every specimen id lands on
// the same composition wherever it is asked for.
const digits = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
};

/** posterFor is the artwork a media slot draws when the screen has no picture of its own: the same composition for the same id, mirrored by the id's own parity. */
export const posterFor = (id: string): Poster => {
  const h = digits(id);
  const spec = LAYOUTS[h % LAYOUTS.length]!;
  const mirror = ((h >>> 4) & 1) === 1;
  return {
    layout: `${spec.layout}${mirror ? "-reversed" : ""}`,
    marks: spec.marks.map((mark) => ({
      ...mark,
      left: mirror ? Number((1 - mark.left - mark.width).toFixed(4)) : mark.left,
    })),
  };
};
