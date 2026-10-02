// Literal public conformance examples, composed through the production factories.
import { Temporal } from "@js-temporal/polyfill";
import { deriveActions, deriveChoices, deriveDataList, deriveSelection } from "./collections";
import { deriveActivity } from "./audit";
import { deriveSurface, deriveDisclosure } from "./surfaces";
import { deriveStepper } from "./stepper";
import { deriveSlots } from "./slots";
import { deriveCalendar } from "./calendar";
import {
  derivePrice,
  deriveQuantity,
  deriveProductCard,
  deriveCart,
  deriveSummary,
  deriveBuyBar,
} from "./commerce";
import { derivePricing } from "./pricing";
import { deriveMeter, derivePlayback } from "./progress";
import { deriveSearch, deriveTabs } from "./navigation";
import { deriveMap } from "./map";
import { deriveMedia, deriveMediaHero, deriveViewer } from "./media";
import { deriveSparkline, deriveChart, deriveBars, deriveStat } from "./charts";
import { deriveState, type Action } from "./feedback";
import type { Presentation } from "./presentation";
import { build, type Validation, type Content } from "./shared";
export const kitCaseIds = [
  "action-control/default",
  "action-control/busy",
  "action-control/disabled",
  "selection-control/off",
  "selection-control/on",
  "selection-control/mixed",
  "selection-control/disabled",
  "choice-chips/default",
  "choice-chips/selected",
  "choice-chips/disabled-option",
  "choice-chips/required",
  "action-bar/multiple",
  "action-bar/busy",
  "action-bar/disabled",
  "model-state/loading",
  "data-list/grouped",
  "data-list/collapsed",
  "data-list/selection-some",
  "data-list/selection-unavailable",
  "data-list/error",
  "data-list/loading",
  "data-list/offline",
  "detail-sheet/open",
  "detail-sheet/dirty",
  "detail-sheet/busy",
  "side-panel/docked",
  "disclosure-section/default",
  "disclosure-section/expanded",
  "more-filters/open",
  "summary-detail/default",
  "activity/before-after",
  "activity/expanded",
  "activity/redacted",
  "activity/excluded",
  "stepper/first",
  "stepper/middle",
  "stepper/last",
  "stepper/empty",
  "stepper/write-unknown",
  "stepper/invalid",
  "slot-option/available",
  "slot-option/full",
  "slot-option/selected",
  "slot-picker/date-strip",
  "slot-picker/expired-snapshot",
  "slot-picker/selection-lost",
  "day-strip/current",
  "week-calendar/overlap",
  "week-calendar/dst-short",
  "week-calendar/dst-long",
  "agenda-list/range",
  "calendar/week",
  "calendar/agenda",
  "price/fraction",
  "price/large-int64",
  "price/negative",
  "price/zero",
  "quantity-control/middle",
  "quantity-control/max",
  "quantity-control/invalid",
  "quantity-control/busy",
  "product-card/options",
  "product-card/sold-out",
  "product-card/loading",
  "buy-bar/default",
  "cart/multiple-lines",
  "cart/empty",
  "cart/quote-expired",
  "cart/checkout-busy",
  "order-summary/receipt",
  "pricing-tiers/default",
  "pricing-tiers/missing-offer",
  "plan-comparison/unknown",
  "map-legend/default",
  "map-with-list/points",
  "map-with-list/same-coordinate",
  "map-with-list/provider-offline",
  "map-with-list/provider-unsupported",
  "map-with-list/selected-removed",
  "media-hero/default",
  "media-hero/loading",
  "media-hero/error",
  "photo-gallery/mixed-ratios",
  "photo-viewer/middle",
  "photo-viewer/selected-removed",
  "masonry-wall/two-columns",
  "sparkline/rising",
  "sparkline/gap",
  "sparkline/one-point",
  "area-chart/multiple-series",
  "area-chart/gaps",
  "bar-chart/negative",
  "stat-tile/lower-is-better",
  "stat-tile/zero-baseline",
  "progress-meter/fraction",
  "progress-meter/percent",
  "progress-meter/steps",
  "progress-meter/unmeasured",
  "tab-bar/three",
  "tab-bar/five",
  "search-field/clear",
  "search-field/query",
  "search-field/busy",
  "mini-player/track",
  "mini-player/live",
  "confirm-dialog/delete",
  "confirm-dialog/keep",
] as const;
export interface GallerySelection {
  readonly open?: boolean;
  readonly choice?: string | undefined;
  readonly selectedIds?: readonly string[];
  readonly quantity?: number;
  readonly expanded?: boolean;
  readonly slot?: string | undefined;
  readonly media?: string;
  readonly point?: string | undefined;
}
export function kitExamples(p: Presentation, caseId: string, held: GallerySelection = {}) {
  return build(p, (v: Validation) => {
    const c = p.copy.kit,
      pt = p.copy.language === "pt",
      name = pt ? "Exemplo" : "Example",
      state = caseId.split("/")[1],
      busy = state === "busy" || state === "checkout-busy",
      disabled = state === "disabled";
    const action: Action = {
      id: "continue",
      label: c.next,
      tone: "primary",
      state: busy ? "busy" : disabled ? "disabled" : "ready",
      ...(disabled ? { reason: c.unavailable } : {}),
    };
    const secondary: Action = {
      id: "inspect",
      label: c.details,
      tone: "secondary",
      state: "ready",
    };
    const empty = v.take(deriveState({ kind: "empty" }, p));
    const sample = <T>(value: T): Content<T> =>
      state === "loading"
        ? { phase: "loading" }
        : state === "empty"
          ? { phase: "empty", state: empty }
          : state === "offline"
            ? { phase: "offline", state: v.take(deriveState({ kind: "offline" }, p)) }
            : state === "error"
              ? {
                  phase: "error",
                  state: v.take(
                    deriveState(
                      {
                        kind: "error",
                        issue: {
                          code: "read-failed",
                          path: "example",
                          recovery: "correctable",
                          message: p.copy.state.error.body,
                        },
                      },
                      p,
                    ),
                  ),
                }
              : { phase: "ready", value, refresh: "idle" };
    const choice = {
      id: "option",
      label: pt ? "Opção" : "Option",
      choices: [
        { id: "first", label: pt ? "Primeira" : "First", enabled: true },
        {
          id: "second",
          label: pt ? "Segunda" : "Second",
          enabled: state !== "disabled-option",
          ...(state === "disabled-option" ? { reason: c.unavailable } : {}),
        },
      ],
      required: state === "required",
      ...(held.choice
        ? { selectedId: held.choice }
        : state === "selected"
          ? { selectedId: "second" }
          : {}),
    };
    const quantity = {
      value: held.quantity ?? (state === "max" ? 10 : state === "invalid" ? 7 : 6),
      min: 2,
      max: 10,
      step: 2,
      label: c.quantity,
      state: action.state,
      ...(action.reason ? { reason: action.reason } : {}),
    };
    const currency = { code: "EUR", fractionDigits: 2 };
    const amount = {
      minor:
        state === "large-int64"
          ? "9223372036854775807"
          : state === "zero"
            ? "0"
            : state === "negative"
              ? "-157"
              : "1299",
      currency,
    };
    const price = { amount, kind: "price" as const };
    const unit = { minor: "1299", currency };
    const safePrice = { amount: unit, kind: "price" as const };
    const instant = Temporal.Instant.from(p.now),
      future = instant.add({ hours: 24 }),
      end = future.add({ minutes: 30 }),
      date = future.toZonedDateTimeISO(p.timeZone).toPlainDate().toString();
    const slot = {
      id: "slot-1",
      start: future.toString(),
      end: end.toString(),
      state: "open" as const,
      capacity: {
        kind: "known" as const,
        total: 4,
        remaining: state === "full" || state === "selection-lost" ? 0 : 2,
      },
    };
    const availability = {
      slots: [slot],
      availabilityVersion: "example-1",
      validUntil: state === "expired-snapshot" ? p.now : instant.add({ hours: 1 }).toString(),
    };
    const status = { label: c.available, tone: "ok" as const, symbol: "check" as const };
    const product = {
      id: "product-1",
      title: name,
      price: safePrice,
      availability: state === "sold-out" ? ("sold-out" as const) : ("available" as const),
      status,
      open: secondary,
      primary: action,
    };
    const line = {
      id: "line-1",
      productId: product.id,
      title: name,
      unitPrice: unit,
      quantity: { ...quantity, value: 2 },
      availability: "available" as const,
      remove: { ...secondary, id: "remove", label: c.remove },
    };
    const quote = {
      id: "quote-1",
      revision: "revision-1",
      total: { minor: state === "multiple-lines" ? "3897" : "2598", currency },
      expiresAt: state === "quote-expired" ? p.now : instant.add({ hours: 1 }).toString(),
    };
    const row = {
      id: "row-1",
      title: name,
      cells: [{ id: "value", label: c.quantity, value: "2" }],
      selectable: true,
      status,
      actions: [secondary],
      open: secondary,
    };
    const selectedIds =
      held.selectedIds ??
      (state === "selection-some"
        ? [row.id]
        : state === "selection-unavailable"
          ? ["removed"]
          : []);
    const surface = {
      open: held.open ?? true,
      title: name,
      close: { ...secondary, id: "close", label: c.close },
      dismissal:
        state === "dirty"
          ? ("confirm" as const)
          : state === "busy"
            ? ("blocked" as const)
            : ("allowed" as const),
      ...(state === "dirty" || state === "busy" ? { reason: c.unsaved } : {}),
      actions: [action],
    };
    const steps = [
      {
        id: "first",
        label: choice.choices[0]!.label,
        optional: false,
        completion: state === "first" ? ("incomplete" as const) : ("complete" as const),
        problems: [],
      },
      {
        id: "second",
        label: choice.choices[1]!.label,
        optional: true,
        completion: "incomplete" as const,
        problems: state === "invalid" ? [{ fieldId: "quantity", message: c.validation }] : [],
      },
    ];
    const calendarDate =
      state === "dst-short" ? "2026-03-29" : state === "dst-long" ? "2026-10-25" : date;
    const calendarStart = Temporal.PlainDate.from(calendarDate)
      .toZonedDateTime(p.timeZone)
      .add({ hours: 9 })
      .toInstant();
    const calendarInput = {
      content: sample([
        {
          id: "event-1",
          title: name,
          kind: "timed" as const,
          start: calendarStart.toString(),
          end: calendarStart.add({ hours: 2 }).toString(),
          open: secondary,
        },
        {
          id: "event-2",
          title: choice.choices[1]!.label,
          kind: "timed" as const,
          start: calendarStart.add({ minutes: 30 }).toString(),
          end: calendarStart.add({ hours: 1 }).toString(),
          open: secondary,
        },
      ]),
      view:
        state === "agenda"
          ? ("agenda" as const)
          : state === "dst-short" || state === "dst-long"
            ? ("day" as const)
            : ("week" as const),
      anchorDate: calendarDate,
      selectedDate: calendarDate,
      agendaEndDate: Temporal.PlainDate.from(calendarDate).add({ days: 7 }).toString(),
    };
    const images = [
      {
        id: "image-1",
        width: 600,
        height: 900,
        description: pt ? "Forma vertical" : "Portrait shape",
        decorative: false,
        state:
          state === "error"
            ? ("error" as const)
            : state === "loading"
              ? ("loading" as const)
              : ("ready" as const),
      },
      {
        id: "image-2",
        width: 1200,
        height: 800,
        description: pt ? "Forma horizontal" : "Landscape shape",
        decorative: false,
        state: "ready" as const,
      },
    ];
    const mediaInput = {
      content: sample(images),
      selectedId: held.media ?? (state === "selected-removed" ? "removed" : "image-2"),
      page: { more: false, loading: false },
    };
    const points = [
      { id: "point-1", longitude: 0, latitude: 0, title: name, status, actions: [secondary] },
      {
        id: "point-2",
        longitude: state === "same-coordinate" ? 0 : 1,
        latitude: 0,
        title: choice.choices[1]!.label,
        status,
        actions: [],
      },
    ];
    const chartInput = {
      content: sample([
        {
          id: "series-1",
          label: name,
          tone: "info" as const,
          points:
            state === "one-point"
              ? [{ id: "p1", x: 7, y: 5 }]
              : [
                  { id: "p1", x: 0, y: 2 },
                  { id: "p2", x: 1, y: state === "gap" || state === "gaps" ? null : 4 },
                  { id: "p3", x: 2, y: 3 },
                ],
        },
      ]),
      xKind: "number" as const,
      xLabel: pt ? "Tempo" : "Time",
      yLabel: c.quantity,
      unitLabel: pt ? "itens" : "items",
      fractionDigits: 0,
      ranges: [],
    };
    return {
      actions: v.take(deriveActions({ label: c.actions, actions: [action, secondary] }, p)),
      choices: v.take(deriveChoices(choice, p)),
      selection: v.take(
        deriveSelection(
          {
            label: c.allLoaded,
            selected: state === "on" ? true : state === "mixed" ? "mixed" : false,
            enabled: !disabled,
            ...(disabled ? { reason: c.unavailable } : {}),
          },
          p,
        ),
      ),
      list: v.take(
        deriveDataList(
          {
            content: sample([
              {
                id: "group",
                title: name,
                rows: [row, { ...row, id: "row-2", title: choice.choices[1]!.label }],
                total: 4,
                collapsible: true,
              },
            ]),
            order: { sort: "", filters: {} },
            filters: [],
            views: [],
            viewDirty: false,
            selection: "multiple",
            selectedIds,
            collapsedIds: state === "collapsed" ? ["group"] : [],
            bulkActions: [action],
            page: { more: false, loading: false },
          },
          p,
        ),
      ),
      surface: v.take(deriveSurface(surface, p)),
      disclosure: v.take(
        deriveDisclosure(
          {
            id: "section",
            title: c.details,
            summary: p.copy.gallery.longBody,
            expanded: held.expanded ?? state === "expanded",
            depth: 1,
            enabled: true,
          },
          p,
        ),
      ),
      activity: v.take(
        deriveActivity(
          {
            content: sample([
              {
                id: "audit-1",
                occurredAt: p.now,
                verb: pt ? "Atualizado" : "Updated",
                actor: { kind: "system" as const },
                changes: [
                  {
                    id: "change",
                    label: c.quantity,
                    before: {
                      kind: state === "redacted" ? ("redacted" as const) : ("missing" as const),
                    },
                    after: { kind: "value" as const, text: "" },
                  },
                ],
              },
            ]),
            expandedIds: state === "expanded" ? ["audit-1"] : [],
            page: { more: false, loading: false },
            excluded: state === "excluded",
          },
          p,
        ),
      ),
      stepper: v.take(
        deriveStepper(
          {
            steps: state === "empty" ? [] : steps,
            ...(state === "empty"
              ? {}
              : { currentId: state === "last" || state === "middle" ? "second" : "first" }),
            phase: state === "write-unknown" ? "write-unknown" : "editing",
            finish: { ...action, label: c.finish },
            saveAndExit: { ...secondary, label: c.saveExit },
            dirty: true,
          },
          p,
        ),
      ),
      slots: v.take(
        deriveSlots(
          {
            content: sample(availability),
            dates: [date],
            selectedDate: date,
            quantity: 2,
            ...(held.slot
              ? { selectedSlotId: held.slot }
              : state === "selected" || state === "selection-lost"
                ? { selectedSlotId: slot.id }
                : {}),
          },
          p,
        ),
      ),
      calendar: v.take(deriveCalendar(calendarInput, p)),
      price: v.take(derivePrice(price, p)),
      quantity: v.take(deriveQuantity(quantity, p)),
      product: v.take(
        deriveProductCard({ content: sample({ product, options: [choice], quantity }) }, p),
      ),
      cart: v.take(
        deriveCart(
          {
            content: sample(
              state === "multiple-lines"
                ? [
                    line,
                    {
                      ...line,
                      id: "line-2",
                      title: choice.choices[1]!.label,
                      quantity: { ...line.quantity, value: 1, min: 1, step: 1 },
                    },
                  ]
                : [line],
            ),
            currency,
            adjustments: [],
            quote,
            checkout: action,
          },
          p,
        ),
      ),
      summary: v.take(
        deriveSummary(
          {
            lines: [{ id: "summary-1", label: name, amount: unit }],
            adjustments: [],
            currency,
            kind: "receipt",
          },
          p,
        ),
      ),
      buy: v.take(deriveBuyBar({ price: safePrice, action }, p)),
      pricing: v.take(
        derivePricing(
          {
            content: sample([
              {
                id: "plan-1",
                title: name,
                offers: [{ periodId: "period-1", price: safePrice, action }],
                features: { feature: { kind: "included" } },
              },
              {
                id: "plan-2",
                title: choice.choices[1]!.label,
                offers:
                  state === "missing-offer"
                    ? []
                    : [
                        {
                          periodId: "period-1",
                          price: { kind: "contact", label: c.details },
                          action: secondary,
                        },
                      ],
                features: {},
              },
            ]),
            periods: [{ id: "period-1", label: c.period }],
            selectedPeriodId: "period-1",
            features: [{ id: "feature", label: c.details }],
          },
          p,
        ),
      ),
      map: v.take(
        deriveMap(
          {
            content: sample(points),
            mode: "map",
            ...(held.point
              ? { selectedId: held.point }
              : state === "selected-removed"
                ? { selectedId: "removed" }
                : {}),
            viewport: { longitude: 0, latitude: 0, zoom: 4 },
            legend: [status],
            capabilities: { latitudeBounds: [-85, 85], zoomBounds: [0, 22] },
            // The map the page leads with is the one that works: an unsupported
            // provider is a state of its own, not the shape of every map screen.
            providerState:
              state === "provider-offline"
                ? "offline"
                : state === "provider-unsupported"
                  ? "unsupported"
                  : "ready",
            ...(state === "provider-offline" ? { providerMessage: p.copy.state.offline.body } : {}),
            attribution: name,
          },
          p,
        ),
      ),
      media: v.take(deriveMedia(mediaInput, p)),
      hero: v.take(deriveMediaHero({ item: images[0]!, title: name, action: secondary }, p)),
      viewer: v.take(deriveViewer({ ...mediaInput, open: held.open ?? true }, p)),
      spark: v.take(deriveSparkline(chartInput, p)),
      chart: v.take(
        deriveChart(
          state === "multiple-series"
            ? {
                ...chartInput,
                content: sample([
                  {
                    id: "series-1",
                    label: name,
                    tone: "info",
                    points: [
                      { id: "a", x: 0, y: 4 },
                      { id: "b", x: 1, y: 8 },
                      { id: "c", x: 2, y: 6 },
                    ],
                  },
                  {
                    id: "series-2",
                    label: choice.choices[1]!.label,
                    tone: "ok",
                    points: [
                      { id: "d", x: 0, y: 2 },
                      { id: "e", x: 1, y: 3 },
                      { id: "f", x: 2, y: 5 },
                    ],
                  },
                ]),
              }
            : chartInput,
          p,
        ),
      ),
      bars: v.take(
        deriveBars(
          {
            content: sample({
              categories: [
                { id: "a", label: choice.choices[0]!.label },
                { id: "b", label: choice.choices[1]!.label },
              ],
              series: [{ id: "values", label: name, tone: "info", values: { a: -2, b: 5 } }],
            }),
            xLabel: chartInput.xLabel,
            yLabel: chartInput.yLabel,
            unitLabel: chartInput.unitLabel,
            fractionDigits: 0,
            ranges: [],
          },
          p,
        ),
      ),
      stat: v.take(
        deriveStat(
          {
            label: name,
            value: 90,
            comparison: state === "zero-baseline" ? 0 : 120,
            fractionDigits: 0,
            preference: "lower",
          },
          p,
        ),
      ),
      // The four interaction shapes the phone owes the most: how far through,
      // where you can go, what the query found, and what is still playing.
      meter: v.take(
        deriveMeter(
          state === "unmeasured"
            ? { value: 7, label: pt ? "Armazenamento" : "Storage" }
            : state === "percent"
              ? { value: 1, max: 4, format: "percent", label: pt ? "Carregamento" : "Upload" }
              : state === "steps"
                ? { value: 2, max: 3, format: "steps", label: c.step }
                : { value: 3, max: 8, label: pt ? "Armazenamento" : "Storage" },
          p,
        ),
      ),
      tabs: v.take(
        deriveTabs(
          state === "five"
            ? {
                tabs: [
                  { id: "today", label: pt ? "Hoje" : "Today", badge: 4 },
                  { id: "sets", label: pt ? "Conjuntos" : "Sets" },
                  { id: "search", label: c.search },
                  { id: "library", label: pt ? "Biblioteca" : "Library", badge: 128 },
                  { id: "you", label: pt ? "Tu" : "You" },
                ],
                selected: "library",
              }
            : {
                tabs: [
                  { id: "today", label: pt ? "Hoje" : "Today", badge: 4 },
                  { id: "search", label: c.search },
                  { id: "you", label: pt ? "Tu" : "You" },
                ],
                selected: "search",
              },
          p,
        ),
      ),
      search: v.take(
        deriveSearch(
          state === "clear"
            ? { value: "", placeholder: c.search }
            : state === "busy"
              ? { value: pt ? "música" : "music", placeholder: c.search, busy: true, count: 12 }
              : { value: pt ? "música" : "music", placeholder: c.search, count: 12 },
          p,
        ),
      ),
      playback: v.take(
        derivePlayback(
          state === "live"
            ? { position: 95, label: pt ? "A tocar" : "Now playing" }
            : { position: 67, total: 247, label: pt ? "A tocar" : "Now playing" },
          p,
        ),
      ),
    };
  });
}
export type KitExamples = Extract<ReturnType<typeof kitExamples>, { ok: true }>["value"];
