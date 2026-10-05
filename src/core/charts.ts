import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import { deriveChoices } from "./collections";
import { inRange, money, moneyText, type Money } from "./commerce";
import { presentedTime, type Presentation } from "./presentation";
import { build, content, issue, type Content, type Status, type Validation } from "./shared";
export interface Point {
  readonly id: string;
  readonly x: number;
  readonly y: number | null;
}
export interface Series {
  readonly id: string;
  readonly label: string;
  readonly tone: Status["tone"];
  readonly points: readonly Point[];
}
export interface ChartInput {
  readonly content: Content<readonly Series[]>;
  readonly xKind: "number" | "time";
  readonly xLabel: string;
  readonly yLabel: string;
  readonly unitLabel: string;
  readonly fractionDigits: number;
  readonly domain?: {
    readonly x: readonly [number, number];
    readonly y: readonly [number, number];
  };
  readonly ranges: readonly { readonly id: string; readonly label: string }[];
  readonly selectedRangeId?: string;
  readonly selectedPoint?: { readonly seriesId: string; readonly pointId: string };
}
function precision(n: number, v: Validation) {
  v.need(Number.isInteger(n) && n >= 0 && n <= 6, "fractionDigits", "unsupported-format");
}
/**
 * zeroRule says where the line a bar or an area is measured from sits in a plot,
 * as the same 0 (top) to 1 (bottom) fraction the tick positions use — and says
 * nothing at all when there is no scale yet. A plot with no measurements has no
 * zero to stand its marks on.
 */
const zeroRule = (y: ((value: number) => number) | undefined): number | undefined => {
  if (!y) return undefined;
  const at = y(0);
  return at >= 0 && at <= 1 ? at : undefined;
};
function domain(
  values: readonly number[],
  supplied: readonly [number, number] | undefined,
  zero: boolean,
  axis: "x" | "y",
  v: Validation,
): readonly [number, number] {
  const samples = zero ? [0, ...values] : [...values];
  let lo = samples.reduce((a, b) => Math.min(a, b), Infinity),
    hi = samples.reduce((a, b) => Math.max(a, b), -Infinity);
  if (supplied) {
    v.need(
      supplied.length === 2 &&
        supplied.every(Number.isFinite) &&
        supplied[0] < supplied[1] &&
        Number.isFinite(supplied[1] - supplied[0]) &&
        samples.every((n) => n >= supplied[0] && n <= supplied[1]),
      `domain.${axis}`,
    );
    return supplied;
  }
  if (lo === hi) {
    const padding = axis === "x" ? 1 : Math.max(Math.abs(lo) * 0.1, 1);
    lo -= padding;
    hi += padding;
  }
  v.need(
    Number.isFinite(lo) && Number.isFinite(hi) && lo < hi && Number.isFinite(hi - lo),
    `domain.${axis}`,
  );
  return [lo, hi];
}
function chart(input: ChartInput, p: Presentation, areaChart: boolean, spark: boolean) {
  return build(p, (v: Validation) => {
    const base = content(input.content, v);
    precision(input.fractionDigits, v);
    v.text(input.xLabel, "xLabel");
    v.text(input.yLabel, "yLabel");
    v.text(input.unitLabel, "unitLabel");
    v.need(input.xKind === "number" || input.xKind === "time", "xKind");
    const series = input.content.phase === "ready" ? input.content.value : [];
    v.ids(series, "series");
    v.need(series.length <= (spark ? 1 : 4), "series", "unsupported-format");
    if (spark)
      v.need(
        input.ranges.length === 0 && !input.selectedPoint && !input.selectedRangeId,
        "sparkline",
        "unsupported-format",
      );
    const format = (value: number) =>
      `${new Intl.NumberFormat(p.locale, { minimumFractionDigits: input.fractionDigits, maximumFractionDigits: input.fractionDigits }).format(value)} ${input.unitLabel}`;
    const xText = (x: number) =>
      input.xKind === "time"
        ? presentedTime(new Date(x), p)
        : new Intl.NumberFormat(p.locale).format(x);
    series.forEach((s, i) => {
      v.text(s.label, `series.${i}.label`);
      v.need(["neutral", "info", "ok", "warning", "danger"].includes(s.tone), `series.${i}.tone`);
      v.ids(s.points, `series.${i}.points`);
      s.points.forEach((point, j) => {
        v.need(
          Number.isFinite(point.x) &&
            (point.y === null || Number.isFinite(point.y)) &&
            (!j || point.x > s.points[j - 1]!.x),
          `series.${i}.points.${j}`,
        );
        if (input.xKind === "time")
          v.need(
            Number.isSafeInteger(point.x) &&
              point.x >= -62167219200000 &&
              point.x <= 253402300799999,
            `series.${i}.points.${j}.x`,
          );
      });
    });
    const all = series.flatMap((s) => s.points),
      finite = all.filter((point) => point.y !== null);
    const ranges = v.take(
      deriveChoices(
        {
          id: "range",
          label: p.copy.kit.range,
          choices: input.ranges.map((range) => ({
            ...range,
            enabled: !base.refreshing,
            ...(base.refreshing ? { reason: p.copy.state.loading } : {}),
          })),
          ...(input.selectedRangeId ? { selectedId: input.selectedRangeId } : {}),
          required: true,
        },
        p,
      ),
    );
    const xDomain =
      all.length || input.domain
        ? domain(
            all.map((point) => point.x),
            input.domain?.x,
            false,
            "x",
            v,
          )
        : undefined;
    const yDomain =
      finite.length || input.domain
        ? domain(
            finite.map((point) => point.y!),
            input.domain?.y,
            areaChart,
            "y",
            v,
          )
        : undefined;
    const x = xDomain ? scaleLinear().domain(xDomain).range([0, 1]) : undefined,
      y = yDomain ? scaleLinear().domain(yDomain).range([1, 0]) : undefined;
    const projected = series.map((s) => {
      const points = s.points.map((point) => ({
        ...point,
        xText: xText(point.x),
        text: point.y === null ? p.copy.kit.missing : format(point.y),
        displayLabel: `${xText(point.x)}: ${point.y === null ? p.copy.kit.missing : format(point.y)}`,
        accessibleLabel: `${s.label}, ${xText(point.x)}: ${point.y === null ? p.copy.kit.missing : format(point.y)}`,
        px: x ? x(point.x) : 0,
        py: point.y !== null && y ? y(point.y) : undefined,
        selected:
          input.selectedPoint?.seriesId === s.id && input.selectedPoint.pointId === point.id,
      }));
      const segments: (typeof points)[] = [];
      let current: typeof points = [];
      for (const point of points) {
        if (point.py === undefined) {
          if (current.length) segments.push(current);
          current = [];
        } else current.push(point);
      }
      if (current.length) segments.push(current);
      const path =
        x && y
          ? (line<Point>()
              .defined((point) => point.y !== null)
              .x((point) => x(point.x))
              .y((point) => y(point.y!))(s.points) ?? undefined)
          : undefined;
      const fill =
        areaChart && x && y
          ? (area<Point>()
              .defined((point) => point.y !== null)
              .x((point) => x(point.x))
              .y0(y(0))
              .y1((point) => y(point.y!))(s.points) ?? undefined)
          : undefined;
      return {
        ...s,
        points,
        segments,
        path,
        fill,
        summary: `${s.label}: ${points.map((point) => `${point.xText}, ${point.text}`).join("; ")}`,
      };
    });
    // A plot is read for one observation before it is read for any other: the
    // largest one. The line is built from the same formatted x and y the axis
    // and the value list use, so the takeaway, the tick and the figure cannot
    // disagree, and a page whose chart says nothing still says its numbers.
    let highest:
        { readonly seriesLabel: string; readonly at: string; readonly text: string } | undefined,
      peak: number | undefined;
    for (const series of projected)
      for (const point of series.points)
        // The first largest observation wins, which is the earliest one drawn.
        if (point.y !== null && (peak === undefined || point.y > peak)) {
          peak = point.y;
          highest = { seriesLabel: series.label, at: point.xText, text: point.text };
        }
    return {
      ...base,
      series: projected,
      takeaway: highest
        ? `${p.copy.kit.peak} · ${highest.seriesLabel} · ${highest.at}: ${highest.text}`
        : undefined,
      ranges,
      xLabel: input.xLabel,
      yLabel: input.yLabel,
      tableLabel: p.copy.kit.table,
      axesLabel: `${input.xLabel} · ${input.yLabel}`,
      empty: finite.length === 0,
      emptyLabel: p.copy.kit.noSamples,
      xDomain,
      yDomain,
      zero: zeroRule(y),
      xTicks: x ? x.ticks(5).map((value) => ({ position: x(value), label: xText(value) })) : [],
      yTicks: y ? y.ticks(5).map((value) => ({ position: y(value), label: format(value) })) : [],
      selectionIssue:
        input.selectedPoint &&
        !projected.some((s) =>
          s.points.some(
            (point) => s.id === input.selectedPoint!.seriesId && point.selected && point.y !== null,
          ),
        )
          ? issue(p, "selectedPoint", "unavailable")
          : undefined,
      clearLabel: p.copy.kit.clear,
    };
  });
}
export const deriveChart = (input: ChartInput, p: Presentation) => chart(input, p, true, false);
export const deriveSparkline = (input: ChartInput, p: Presentation) => chart(input, p, false, true);
export type ChartModel = Extract<ReturnType<typeof deriveChart>, { ok: true }>["value"];
export type SparklineModel = ChartModel;
export interface BarData {
  readonly categories: readonly { readonly id: string; readonly label: string }[];
  readonly series: readonly {
    readonly id: string;
    readonly label: string;
    readonly tone: Status["tone"];
    readonly values: Readonly<Record<string, number | null>>;
  }[];
}
export interface BarInput {
  readonly content: Content<BarData>;
  readonly xLabel: string;
  readonly yLabel: string;
  readonly unitLabel: string;
  readonly fractionDigits: number;
  readonly yDomain?: readonly [number, number];
  readonly ranges: ChartInput["ranges"];
  readonly selectedRangeId?: string;
  readonly selectedCategoryId?: string;
}
export function deriveBars(input: BarInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const base = content(input.content, v);
    precision(input.fractionDigits, v);
    v.text(input.xLabel, "xLabel");
    v.text(input.yLabel, "yLabel");
    v.text(input.unitLabel, "unitLabel");
    const data =
      input.content.phase === "ready" ? input.content.value : { categories: [], series: [] };
    v.ids(data.categories, "categories");
    v.ids(data.series, "series");
    v.need(data.series.length <= 4, "series", "unsupported-format");
    data.categories.forEach((c) => v.text(c.label, "categories.label"));
    data.series.forEach((s, i) => {
      v.text(s.label, `series.${i}.label`);
      v.need(["neutral", "info", "ok", "warning", "danger"].includes(s.tone), `series.${i}.tone`);
      Object.entries(s.values).forEach(([id, value]) =>
        v.need(
          data.categories.some((c) => c.id === id) && (value === null || Number.isFinite(value)),
          `series.${i}.values.${id}`,
        ),
      );
    });
    const finite = data.series.flatMap((s) =>
      Object.values(s.values).filter((n): n is number => n !== null),
    );
    const format = (value: number) =>
      `${new Intl.NumberFormat(p.locale, { minimumFractionDigits: input.fractionDigits, maximumFractionDigits: input.fractionDigits }).format(value)} ${input.unitLabel}`;
    const yDomain =
      finite.length || input.yDomain ? domain(finite, input.yDomain, true, "y", v) : undefined;
    const y = yDomain ? scaleLinear().domain(yDomain).range([1, 0]) : undefined;
    const ranges = v.take(
      deriveChoices(
        {
          id: "ranges",
          label: p.copy.kit.range,
          choices: input.ranges.map((r) => ({
            ...r,
            enabled: !base.refreshing,
            ...(base.refreshing ? { reason: p.copy.state.loading } : {}),
          })),
          ...(input.selectedRangeId ? { selectedId: input.selectedRangeId } : {}),
          required: true,
        },
        p,
      ),
    );
    return {
      ...base,
      ranges,
      xLabel: input.xLabel,
      yLabel: input.yLabel,
      axesLabel: `${input.xLabel} · ${input.yLabel}`,
      tableLabel: p.copy.kit.table,
      empty: !finite.length,
      emptyLabel: p.copy.kit.noSamples,
      yDomain,
      zero: zeroRule(y),
      // The plot draws its own scale: a bar with no numbers beside it cannot be
      // read as anything but a taller or shorter shape.
      yTicks: y ? y.ticks(5).map((value) => ({ position: y(value), label: format(value) })) : [],
      categories: data.categories.map((c) => ({
        ...c,
        selected: input.selectedCategoryId === c.id,
        values: data.series.map((s) => {
          const value = s.values[c.id] ?? null;
          const text = value === null ? p.copy.kit.missing : format(value);
          return {
            seriesId: s.id,
            label: s.label,
            tone: s.tone,
            value,
            text,
            accessibleLabel: `${c.label}, ${s.label}: ${text}`,
            top: y && value !== null ? Math.min(y(value), y(0)) : 0,
            height: y && value !== null ? Math.abs(y(value) - y(0)) : 0,
          };
        }),
      })),
      selectionIssue:
        input.selectedCategoryId && !data.categories.some((c) => c.id === input.selectedCategoryId)
          ? issue(p, "selectedCategoryId", "unavailable")
          : undefined,
    };
  });
}
export type BarModel = Extract<ReturnType<typeof deriveBars>, { ok: true }>["value"];
export interface StatInput {
  readonly label: string;
  readonly value: number | Money;
  readonly comparison?: number | Money;
  readonly fractionDigits: number;
  readonly unitLabel?: string;
  readonly preference: "higher" | "lower" | "neutral";
}
function percentText(tenths: bigint, p: Presentation): string {
  const negative = tenths < 0n,
    magnitude = negative ? -tenths : tenths;
  const whole = new Intl.NumberFormat(p.locale, { maximumFractionDigits: 0 }).format(
      magnitude / 10n,
    ),
    fraction = new Intl.NumberFormat(p.locale, { useGrouping: false }).format(magnitude % 10n);
  return new Intl.NumberFormat(p.locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "always",
  })
    .formatToParts(negative ? -1 : 1)
    .map((part) =>
      part.type === "integer" ? whole : part.type === "fraction" ? fraction : part.value,
    )
    .join("");
}
export function deriveStat(input: StatInput, p: Presentation) {
  return build(p, (v: Validation) => {
    v.text(input.label, "label");
    precision(input.fractionDigits, v);
    v.need(["higher", "lower", "neutral"].includes(input.preference), "preference");
    let text: string,
      delta: string | undefined,
      percent: string | undefined,
      direction = 0;
    const format = (n: number) =>
      new Intl.NumberFormat(p.locale, {
        minimumFractionDigits: input.fractionDigits,
        maximumFractionDigits: input.fractionDigits,
      }).format(n);
    if (typeof input.value === "number") {
      v.need(Number.isFinite(input.value), "value");
      text = format(input.value);
      if (input.comparison !== undefined) {
        v.need(
          typeof input.comparison === "number" && Number.isFinite(input.comparison),
          "comparison",
        );
        const diff = input.value - input.comparison;
        v.need(Number.isFinite(diff), "delta");
        direction = Math.sign(diff);
        delta = `${diff > 0 ? "+" : ""}${format(diff)}`;
        if (input.comparison !== 0) {
          const ratio = (1000 * diff) / Math.abs(input.comparison);
          v.need(Number.isFinite(ratio) && Number.isSafeInteger(Math.trunc(ratio)), "percent");
          percent = percentText(BigInt(Math.sign(ratio) * Math.floor(Math.abs(ratio) + 0.5)), p);
        }
      }
    } else {
      const current = money(input.value, v, "value");
      text = moneyText(input.value, p);
      if (input.comparison !== undefined) {
        v.need(typeof input.comparison !== "number", "comparison");
        const previous = money(input.comparison, v, "comparison", input.value.currency),
          diff = current - previous;
        inRange(diff, v, "delta");
        direction = diff > 0n ? 1 : diff < 0n ? -1 : 0;
        delta = `${diff > 0n ? "+" : ""}${moneyText({ minor: diff.toString(), currency: input.value.currency }, p)}`;
        if (previous !== 0n) {
          const denominator = previous < 0n ? -previous : previous,
            numerator = (diff < 0n ? -diff : diff) * 1000n;
          const rounded = (numerator * 2n + denominator) / (denominator * 2n);
          percent = percentText(diff < 0n ? -rounded : rounded, p);
        }
      }
    }
    const favorable =
      input.preference === "neutral" || !direction
        ? undefined
        : input.preference === "higher"
          ? direction > 0
          : direction < 0;
    return {
      deltaLabel: delta
        ? `${direction > 0 ? "↑" : direction < 0 ? "↓" : "="} ${direction > 0 ? p.copy.kit.increase : direction < 0 ? p.copy.kit.decrease : p.copy.kit.unchanged}: ${delta}`
        : undefined,
      label: input.label,
      text: input.unitLabel ? `${text} ${input.unitLabel}` : text,
      delta,
      percent: input.comparison === undefined ? undefined : (percent ?? p.copy.kit.noBaseline),
      direction:
        direction > 0
          ? p.copy.kit.increase
          : direction < 0
            ? p.copy.kit.decrease
            : p.copy.kit.unchanged,
      symbol: direction > 0 ? "↑" : direction < 0 ? "↓" : "=",
      tone:
        favorable === undefined
          ? ("neutral" as const)
          : favorable
            ? ("ok" as const)
            : ("warning" as const),
      meaning:
        favorable === undefined
          ? undefined
          : favorable
            ? p.copy.kit.favorable
            : p.copy.kit.unfavorable,
    };
  });
}
export type StatModel = Extract<ReturnType<typeof deriveStat>, { ok: true }>["value"];
