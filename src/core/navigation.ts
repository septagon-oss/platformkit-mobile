// navigation.ts holds what a phone's destinations are: a bar of two to five
// places, each with the badge it carries. The ceiling is the pattern's, not a
// preference — past five the labels truncate and no destination is a tap
// shorter away — and a bar of one is a button wearing a bar's clothes.
import { type Presentation } from "./presentation";
import { build, type Validation } from "./shared";

export interface Tab {
  readonly id: string;
  readonly label: string;
  readonly badge?: number;
}

export interface TabsInput {
  readonly tabs: readonly Tab[];
  readonly selected: string;
}

/** badgeText is what fits: a count over 99 is a crowd, not a number. */
export function badgeText(badge: number, p: Presentation): string {
  const whole = new Intl.NumberFormat(p.locale, { maximumFractionDigits: 0 }).format(badge);
  return badge > 99 ? `${new Intl.NumberFormat(p.locale).format(99)}+` : whole;
}

export function deriveTabs(input: TabsInput, p: Presentation) {
  return build(p, (v: Validation) => {
    v.ids(input.tabs, "tabs");
    v.need(input.tabs.length >= 2, "tabs");
    v.need(input.tabs.length <= 5, "tabs");
    input.tabs.forEach((tab, i) => {
      v.text(tab.label, `tabs.${i}.label`);
      if (tab.badge !== undefined)
        v.need(Number.isSafeInteger(tab.badge) && tab.badge >= 0, `tabs.${i}.badge`);
    });
    v.need(
      input.tabs.some((tab) => tab.id === input.selected),
      "selected",
    );
    return {
      items: input.tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        selected: tab.id === input.selected,
        badge: tab.badge === undefined ? undefined : badgeText(tab.badge, p),
      })),
      label: p.copy.kit.navigate,
    };
  });
}
export type TabsModel = Extract<ReturnType<typeof deriveTabs>, { ok: true }>["value"];

export interface SearchInput {
  readonly value: string;
  readonly placeholder: string;
  readonly busy?: boolean;
  /** count is what the query narrowed to, printed where the field is. */
  readonly count?: number;
  /** narrowed says a query is in force, which is what answers with the filtered empty state. */
  readonly narrowed?: boolean;
}

export function deriveSearch(input: SearchInput, p: Presentation) {
  return build(p, (v: Validation) => {
    v.text(input.placeholder, "placeholder");
    if (input.count !== undefined)
      v.need(Number.isSafeInteger(input.count) && input.count >= 0, "count");
    return {
      value: input.value,
      placeholder: input.placeholder,
      busy: input.busy ?? false,
      countText:
        input.count === undefined
          ? undefined
          : `${new Intl.NumberFormat(p.locale, { maximumFractionDigits: 0 }).format(input.count)} ${p.copy.kit.results}`,
      clearLabel: p.copy.kit.clearSearch,
      cancelLabel: p.copy.kit.cancelSearch,
      searching: p.copy.kit.searching,
      label: p.copy.kit.search,
      count: input.count,
      narrowed: input.narrowed ?? input.value.trim().length > 0,
    };
  });
}
export type SearchModel = Extract<ReturnType<typeof deriveSearch>, { ok: true }>["value"];
