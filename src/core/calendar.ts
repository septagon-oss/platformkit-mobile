import { Temporal } from "@js-temporal/polyfill";
import type { Action } from "./feedback";
import { instantValue, presentedTime, type Presentation } from "./presentation";
import { civilDate, dateAt, type LocalDate } from "./slots";
import {
  action,
  build,
  content,
  issue,
  pageControl,
  status,
  type Content,
  type Page,
  type Status,
  type Validation,
} from "./shared";
export type CalendarEvent = {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly status?: Status;
  readonly open?: Action;
} & (
  | { readonly kind: "timed"; readonly start: string; readonly end: string }
  | { readonly kind: "all-day"; readonly startDate: LocalDate; readonly endDate: LocalDate }
);
export interface CalendarInput {
  readonly content: Content<readonly CalendarEvent[]>;
  readonly view: "day" | "week" | "agenda";
  readonly anchorDate: LocalDate;
  readonly selectedDate: LocalDate;
  readonly selectedEventId?: string;
  readonly minDate?: LocalDate;
  readonly maxDate?: LocalDate;
  readonly agendaEndDate: LocalDate;
  readonly page?: Page;
}
interface Segment {
  readonly id: string;
  readonly title: string;
  readonly label: string;
  readonly start: number;
  readonly end: number;
  readonly top: number;
  readonly height: number;
  readonly kind: "timed" | "all-day";
  readonly status?: Status;
  readonly selected: boolean;
  readonly enabled: boolean;
  readonly lane: number;
  readonly lanes: number;
  readonly group: number;
}
function lanes(segments: readonly Segment[]): readonly Segment[] {
  const result: Segment[] = [];
  let group: Segment[] = [],
    ends: number[] = [],
    groupEnd = -Infinity,
    groupId = 0;
  const flush = () => {
    result.push(...group.map((s) => ({ ...s, lanes: ends.length })));
    group = [];
    ends = [];
    groupId++;
  };
  for (const segment of segments) {
    if (segment.start >= groupEnd && group.length) flush();
    let lane = ends.findIndex((end) => end <= segment.start);
    if (lane < 0) lane = ends.length;
    ends[lane] = segment.end;
    groupEnd = Math.max(groupEnd, segment.end);
    group.push({ ...segment, lane, group: groupId });
  }
  flush();
  return result;
}
export function deriveCalendar(input: CalendarInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const base = content(input.content, v),
      anchor = civilDate(input.anchorDate),
      selected = civilDate(input.selectedDate),
      agendaEnd = civilDate(input.agendaEndDate);
    v.need(
      anchor && selected && agendaEnd && Temporal.PlainDate.compare(agendaEnd, anchor) > 0,
      "dates",
    );
    v.need(["day", "week", "agenda"].includes(input.view), "view");
    if (input.minDate) v.need(civilDate(input.minDate), "minDate");
    if (input.maxDate) v.need(civilDate(input.maxDate), "maxDate");
    v.need(!input.minDate || !input.maxDate || input.minDate <= input.maxDate, "bounds");
    const inBounds = (date: string) =>
      (!input.minDate || date >= input.minDate) && (!input.maxDate || date <= input.maxDate);
    v.need(inBounds(input.selectedDate), "selectedDate", "unavailable");
    const today = dateAt(p.now, p.timeZone);
    const offset = (anchor.dayOfWeek - p.weekStartsOn + 7) % 7;
    const weekStart = anchor.subtract({ days: offset });
    const start = input.view === "week" ? weekStart : input.view === "day" ? selected : anchor;
    const length =
      input.view === "week" ? 7 : input.view === "day" ? 1 : anchor.until(agendaEnd).days;
    // The producer chooses a bounded page instead of an unbounded in-memory calendar.
    v.need(length <= 366, "agendaEndDate", "unsupported-format");
    const events = input.content.phase === "ready" ? input.content.value : [];
    v.ids(events, "events");
    for (const [i, e] of events.entries()) {
      v.text(e.title, `events.${i}.title`);
      status(e.status, v, `events.${i}.status`);
      if (e.open) action(e.open, v, `events.${i}.open`);
      if (e.kind === "timed") {
        const s = instantValue(e.start),
          end = instantValue(e.end);
        v.need(
          s && end && end > s && !("startDate" in e) && !("endDate" in e),
          `events.${i}.interval`,
        );
      } else {
        v.need(
          e.kind === "all-day" &&
            civilDate(e.startDate) &&
            civilDate(e.endDate) &&
            e.endDate > e.startDate &&
            !("start" in e) &&
            !("end" in e),
          `events.${i}.dates`,
        );
      }
    }
    const dateLabel = (date: Temporal.PlainDate) =>
      new Intl.DateTimeFormat(p.locale, {
        timeZone: "UTC",
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date(`${date.toString()}T12:00:00Z`));
    const days = Array.from({ length }, (_, i) => {
      const date = start.add({ days: i }),
        id = date.toString();
      const begin = date.toZonedDateTime(p.timeZone).epochMilliseconds,
        end = date.add({ days: 1 }).toZonedDateTime(p.timeZone).epochMilliseconds,
        duration = end - begin;
      const allDay: Segment[] = [],
        timed: Segment[] = [];
      for (const e of events) {
        const common = {
          id: e.id,
          title: e.title,
          ...(e.status ? { status: e.status } : {}),
          selected: e.id === input.selectedEventId,
          enabled: e.open?.state === "ready",
          lane: 0,
          lanes: 1,
          group: 0,
        };
        if (e.kind === "all-day") {
          if (e.startDate <= id && id < e.endDate)
            allDay.push({
              ...common,
              label: `${e.title} · ${p.copy.kit.allDay}`,
              start: begin,
              end,
              top: 0,
              height: 0,
              kind: "all-day",
            });
        } else {
          const actualStart = instantValue(e.start)!.getTime(),
            actualEnd = instantValue(e.end)!.getTime(),
            s = Math.max(begin, actualStart),
            finish = Math.min(end, actualEnd);
          if (finish > s)
            timed.push({
              ...common,
              start: s,
              end: finish,
              top: (s - begin) / duration,
              height: (finish - s) / duration,
              kind: "timed",
              label: `${e.title} · ${presentedTime(new Date(actualStart), p)} – ${presentedTime(new Date(actualEnd), p)}${actualStart < begin || actualEnd > end ? ` · ${p.copy.kit.continues}` : ""}`,
            });
        }
      }
      timed.sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));
      allDay.sort((a, b) => a.id.localeCompare(b.id));
      const ticks = Array.from({ length: Math.ceil(duration / 3600000) }, (_, i) => {
        const at = begin + i * 3600000;
        const z = Temporal.Instant.fromEpochMilliseconds(at).toZonedDateTimeISO(p.timeZone);
        return {
          position: (at - begin) / duration,
          label: `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")} ${z.offset}`,
        };
      });
      return {
        id,
        title: dateLabel(date),
        today: id === today,
        selected: id === input.selectedDate,
        enabled: inBounds(id),
        minutes: duration / 60000,
        ticks,
        events: [...allDay, ...lanes(timed)],
        emptyLabel: p.copy.kit.noEvents,
        moreLabel: p.copy.kit.moreEvents,
      };
    });
    const range = (delta: number) => {
      const first = start.add({ days: delta }),
        target = selected.add({ days: delta });
      return {
        enabled: inBounds(target.toString()),
        target: {
          startDate: first.toString(),
          endDate: first.add({ days: length }).toString(),
          selectedDate: target.toString(),
        },
      };
    };
    const todayDate = civilDate(today)!;
    const todayStart =
      input.view === "week"
        ? todayDate.subtract({ days: (todayDate.dayOfWeek - p.weekStartsOn + 7) % 7 })
        : todayDate;
    const navigation = {
      previous: { ...range(-length), label: p.copy.kit.previous },
      next: { ...range(length), label: p.copy.kit.next },
      today: {
        label: p.copy.kit.today,
        enabled: inBounds(today),
        target: {
          startDate: todayStart.toString(),
          endDate: todayStart.add({ days: length }).toString(),
          selectedDate: today,
        },
      },
    };
    const strip = {
      days: Array.from({ length: 7 }, (_, i) => {
        const d = weekStart.add({ days: i }),
          id = d.toString();
        return {
          id,
          title: dateLabel(d),
          selected: id === input.selectedDate,
          today: id === today,
          todayLabel: p.copy.kit.today,
          enabled: inBounds(id),
        };
      }),
      navigation,
    };
    const selectionIssue =
      input.selectedEventId &&
      !days.some((d) => d.events.some((e) => e.id === input.selectedEventId))
        ? issue(p, "selectedEventId", "unavailable")
        : undefined;
    const week = { ...base, days, selectionIssue };
    const agenda = {
      ...week,
      more: input.page ? pageControl(input.page, v, input.content.phase === "ready") : undefined,
      pageError: input.page?.error,
      feedback: { ...p, loadingLabel: p.copy.state.loading, retryLabel: p.copy.state.retry },
    };
    return {
      strip,
      week,
      agenda,
      calendar: {
        ...week,
        view: input.view,
        strip,
        agenda,
        navigation,
        views: (["day", "week", "agenda"] as const).map((id) => ({
          id,
          label: p.copy.kit[id],
          selected: id === input.view,
        })),
      },
    };
  });
}
export type CalendarModels = Extract<ReturnType<typeof deriveCalendar>, { ok: true }>["value"];
export type CalendarModel = CalendarModels["calendar"];
export type DayStripModel = CalendarModels["strip"];
export type WeekModel = CalendarModels["week"];
export type AgendaModel = CalendarModels["agenda"];
/** Measured native lengths enter this pure decision; UI does not repeat hit-area rules. */
export function calendarTargets(day: WeekModel["days"][number], extent: number, hit: number) {
  const groups = new Map<number, Segment[]>();
  day.events
    .filter((e) => e.kind === "timed")
    .forEach((e) => groups.set(e.group, [...(groups.get(e.group) ?? []), e]));
  return [...groups.values()].map((events) => ({
    events,
    grouped: events.some((e) => e.height * extent < hit),
    label: `${day.moreLabel} (${events.length})`,
    date: day.id,
    eventIds: events.map((e) => e.id),
  }));
}
