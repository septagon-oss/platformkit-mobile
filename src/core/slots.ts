import { Temporal } from "@js-temporal/polyfill";
import { instantValue, presentedRange, type Presentation } from "./presentation";
import { build, content, issue, type Content, type Validation } from "./shared";
export type LocalDate = string;
export function civilDate(value: string): Temporal.PlainDate | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  try {
    return Temporal.PlainDate.from(value, { overflow: "reject" });
  } catch {
    return;
  }
}
export function dateAt(instant: string, zone: string): string {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(zone).toPlainDate().toString();
}
export interface Slot {
  readonly id: string;
  readonly start: string;
  readonly end: string;
  readonly state: "open" | "closed" | "booked";
  readonly capacity:
    | { readonly kind: "known"; readonly total: number; readonly remaining: number }
    | { readonly kind: "unknown" };
  readonly reason?: string;
}
export interface Availability {
  readonly slots: readonly Slot[];
  readonly availabilityVersion: string;
  readonly validUntil: string;
}
export interface SlotPickerInput {
  readonly content: Content<Availability>;
  readonly dates: readonly LocalDate[];
  readonly selectedDate: LocalDate;
  readonly selectedSlotId?: string;
  readonly quantity: number;
  readonly bookedLabel?: string;
}
export function deriveSlots(input: SlotPickerInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const base = content(input.content, v);
    v.need(input.dates.length > 0, "dates");
    input.dates.forEach((d, i) =>
      v.need(civilDate(d) && (!i || d > input.dates[i - 1]!), `dates.${i}`),
    );
    v.need(input.dates.includes(input.selectedDate), "selectedDate", "unavailable");
    v.need(Number.isSafeInteger(input.quantity) && input.quantity > 0, "quantity");
    const now = instantValue(p.now)!.getTime();
    const snapshot = input.content.phase === "ready" ? input.content.value : undefined;
    if (snapshot) {
      v.text(snapshot.availabilityVersion, "availabilityVersion");
      v.need(instantValue(snapshot.validUntil), "validUntil");
      v.ids(snapshot.slots, "slots");
    }
    const fresh = snapshot ? now < instantValue(snapshot.validUntil)!.getTime() : false;
    const slots = (snapshot?.slots ?? [])
      .map((s, i) => {
        const start = instantValue(s.start),
          end = instantValue(s.end);
        v.need(start && end && end > start, `slots.${i}.interval`);
        v.need(["open", "closed", "booked"].includes(s.state), `slots.${i}.state`);
        v.need(s.capacity.kind === "known" || s.capacity.kind === "unknown", `slots.${i}.capacity`);
        if (s.capacity.kind === "known")
          v.need(
            Number.isSafeInteger(s.capacity.total) &&
              Number.isSafeInteger(s.capacity.remaining) &&
              s.capacity.total >= 0 &&
              s.capacity.remaining >= 0 &&
              s.capacity.remaining <= s.capacity.total,
            `slots.${i}.capacity`,
          );
        const reason =
          s.state === "booked"
            ? (input.bookedLabel ?? p.copy.kit.booked)
            : s.state === "closed"
              ? (s.reason ?? p.copy.kit.closed)
              : start.getTime() <= now
                ? p.copy.kit.past
                : !fresh
                  ? p.copy.kit.expired
                  : s.capacity.kind === "unknown"
                    ? p.copy.kit.unknownCapacity
                    : s.capacity.remaining < input.quantity
                      ? p.copy.kit.full
                      : !base.writable
                        ? p.copy.kit.unavailable
                        : undefined;
        return {
          id: s.id,
          start: start.toISOString(),
          date: dateAt(s.start, p.timeZone),
          label: presentedRange(start, end, p),
          // The spoken line is the same sentence: the raw offset remains its own
          // field for anything that has to read it, and does not clutter the label.
          displayLabel: presentedRange(start, end, p),
          offset: Temporal.Instant.from(s.start).toZonedDateTimeISO(p.timeZone).offset,
          reason,
          enabled: !reason,
          selected: input.selectedSlotId === s.id,
          capacity:
            s.capacity.kind === "known"
              ? `${p.copy.kit.capacity}: ${s.capacity.remaining}/${s.capacity.total}`
              : p.copy.kit.unknownCapacity,
          target: {
            slotId: s.id,
            availabilityVersion: snapshot!.availabilityVersion,
            quantity: input.quantity,
          },
        };
      })
      .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
    const visible = slots.filter((s) => s.date === input.selectedDate);
    return {
      ...base,
      slots: visible,
      dates: input.dates.map((date) => ({
        id: date,
        label: new Intl.DateTimeFormat(p.locale, {
          timeZone: "UTC",
          weekday: "short",
          day: "numeric",
          month: "short",
        }).format(new Date(`${date}T12:00:00Z`)),
        selected: date === input.selectedDate,
      })),
      selectionIssue:
        input.selectedSlotId && !visible.some((s) => s.selected && s.enabled)
          ? issue(p, "selectedSlotId", "unavailable")
          : undefined,
      canClear: input.selectedSlotId !== undefined,
      clearLabel: p.copy.kit.clear,
      refreshLabel: p.copy.kit.refresh,
      expired: snapshot && !fresh ? p.copy.kit.expired : undefined,
    };
  });
}
export type SlotPickerModel = Extract<ReturnType<typeof deriveSlots>, { ok: true }>["value"];
export type SlotOptionModel = SlotPickerModel["slots"][number];
