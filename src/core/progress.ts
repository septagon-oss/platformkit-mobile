// progress.ts holds the one arithmetic every "how much is left" question needs,
// so a meter, a stepper rail and a player's scrubber say the same thing about
// the same numbers. Three shapes exist and nothing else: a fraction of a known
// whole, a count with no denominator, and elapsed time whose total is unknown.
// A fraction nobody can compute is refused, never drawn as a guess.
import { type Presentation } from "./presentation";
import { build, type Validation } from "./shared";

export type MeterFormat = "fraction" | "percent" | "steps";

export interface MeterInput {
  readonly value: number;
  /** max absent says the whole is unknown, which is a shape, not a zero. */
  readonly max?: number;
  readonly format?: MeterFormat;
  readonly label: string;
}

function count(value: number, p: Presentation): string {
  return new Intl.NumberFormat(p.locale, { maximumFractionDigits: 0 }).format(value);
}

export function deriveMeter(input: MeterInput, p: Presentation) {
  return build(p, (v: Validation) => {
    v.text(input.label, "label");
    v.need(Number.isSafeInteger(input.value) && input.value >= 0, "value");
    const format = input.format ?? "fraction";
    v.need(["fraction", "percent", "steps"].includes(format), "format");
    if (input.max === undefined) {
      return {
        kind: "indeterminate" as const,
        fraction: undefined as number | undefined,
        label: input.label,
        value: input.value,
        max: undefined as number | undefined,
        text: count(input.value, p),
        reason: p.copy.kit.unmeasured,
      };
    }
    // A denominator of zero is not a percentage and a count past the whole is
    // not a fraction: both refuse naming the field at fault.
    v.need(Number.isSafeInteger(input.max) && input.max > 0, "max");
    v.need(input.value <= input.max, "value");
    const fraction = input.value / input.max;
    const text =
      format === "percent"
        ? new Intl.NumberFormat(p.locale, { style: "percent", maximumFractionDigits: 0 }).format(
            // A percent a person reads is a promise about where the work stands, so
            // the rounding clamps at the two ends: a whole that is not finished never
            // reads 100% and one that has started never reads 0%.
            clampedPercent(input.value, input.max, fraction),
          )
        : format === "steps"
          ? `${p.copy.kit.step} ${count(input.value, p)} ${p.copy.kit.of} ${count(input.max, p)}`
          : `${count(input.value, p)} ${p.copy.kit.of} ${count(input.max, p)}`;
    return {
      kind: "determinate" as const,
      fraction: Math.min(1, Math.max(0, fraction)) as number,
      label: input.label,
      value: input.value,
      max: input.max as number,
      text,
      reason: undefined as string | undefined,
    };
  });
}
/** clampedPercent keeps the nearest whole percent honest at both ends of a whole. */
function clampedPercent(value: number, max: number, fraction: number): number {
  const percent = Math.round(fraction * 100) / 100;
  if (value === 0) return 0;
  if (value >= max) return 1;
  return Math.min(0.99, Math.max(0.01, percent));
}

export type MeterModel = Extract<ReturnType<typeof deriveMeter>, { ok: true }>["value"];

export interface PlaybackInput {
  /** Both are whole seconds the caller measured; this module owns no clock. */
  readonly position: number;
  readonly total?: number;
  readonly label: string;
}

/** PlaybackWords names the player's controls in the person's language. */
export interface PlaybackWords {
  readonly play: string;
  readonly pause: string;
  readonly rewind: string;
  readonly skipAhead: string;
}

/** clockText speaks a duration the way a player prints it: 4:07, or 1:02:07. */
export function clockText(seconds: number): string {
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const pair = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pair(m)}:${pair(s)}` : `${m}:${pair(s)}`;
}

export function derivePlayback(input: PlaybackInput, p: Presentation) {
  return build(p, (v: Validation) => {
    // A control's name is copy, and copy belongs to the core: the strip draws these
    // words rather than spelling an intent id a screen reader would read aloud.
    const words: PlaybackWords = {
      play: p.copy.kit.play,
      pause: p.copy.kit.pause,
      rewind: p.copy.kit.rewind,
      skipAhead: p.copy.kit.skipAhead,
    };
    v.text(input.label, "label");
    v.need(Number.isSafeInteger(input.position) && input.position >= 0, "position");
    if (input.total === undefined) {
      return {
        kind: "elapsed" as const,
        position: input.position,
        total: undefined as number | undefined,
        fraction: undefined as number | undefined,
        elapsed: clockText(input.position),
        remaining: undefined as string | undefined,
        seekable: false,
        label: input.label,
        words,
        reason: p.copy.kit.unmeasured,
      };
    }
    v.need(Number.isSafeInteger(input.total) && input.total > 0, "total");
    v.need(input.position <= input.total, "position");
    const left = input.total - input.position;
    return {
      kind: "scrubbed" as const,
      position: input.position,
      total: input.total as number,
      fraction: Math.min(1, Math.max(0, input.position / input.total)) as number,
      elapsed: clockText(input.position),
      remaining: `${clockText(left)} ${p.copy.kit.left}`,
      seekable: true,
      label: input.label,
      words,
      reason: undefined as string | undefined,
    };
  });
}
export type PlaybackModel = Extract<ReturnType<typeof derivePlayback>, { ok: true }>["value"];
