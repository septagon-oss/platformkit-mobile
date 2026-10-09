import type { Entry } from "./catalog";
import {
  enumLabel,
  fieldLabel,
  filterFields,
  label,
  listCells,
  listPreview,
  narrowed,
  noun,
  nounPhrase,
  readPhase,
  saidValue,
  sortOptions,
  text,
  type Order,
  type Row,
} from "./derive";
import { deriveDataList, type DataSection, type Filter } from "./collections";
import { deriveState } from "./feedback";
import type { Presentation } from "./presentation";
import { build, type Validation, type Content } from "./shared";
export interface CatalogListInput {
  readonly entry: Entry;
  readonly rows: readonly Row[];
  readonly total: number;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly more: boolean;
  readonly error: string;
  readonly order: Order;
  readonly ordering: boolean;
  readonly canCreate: boolean;
}
export function deriveCatalogList(input: CatalogListInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const { entry } = input,
      fields = listCells(entry),
      preview = listPreview(entry),
      named = nounPhrase(entry),
      phase = readPhase(input.loading, input.rows.length, input.error);
    const state = input.error
      ? v.take(
          deriveState(
            {
              kind: "error",
              issue: {
                code: "read-failed",
                path: "list",
                recovery: "correctable",
                message: input.error,
              },
              action: {
                intent: "retry-read",
                control: {
                  id: "refresh",
                  label: p.copy.state.retry,
                  tone: "plain",
                  state: "ready",
                },
              },
            },
            p,
          ),
        )
      : undefined;
    const sections: readonly DataSection[] = [
      {
        id: "records",
        title: noun(entry).plural,
        rows: input.rows.map((row) => ({
          id: text(row.id),
          title: label(entry, row, p.copy.kit.untitled),
          ...(preview && text(row[preview.name]) ? { summary: text(row[preview.name]) } : {}),
          cells: fields.map((field) => ({
            id: field.name,
            label: fieldLabel(field),
            ...saidValue(field, row[field.name], p),
          })),
          selectable: false,
          actions: [],
          open: { id: "open", label: p.copy.kit.open, tone: "plain", state: "ready" },
        })),
        total: input.total,
        collapsible: false,
      },
    ];
    const content: Content<readonly DataSection[]> =
      phase === "ready"
        ? {
            phase: "ready",
            value: sections,
            refresh: state ? "error" : input.refreshing ? "loading" : "idle",
            ...(state ? { notice: state } : {}),
          }
        : phase === "loading"
          ? { phase: "loading" }
          : phase === "error"
            ? { phase: "error", state: state! }
            : {
                phase: "empty",
                state: v.take(
                  deriveState(
                    {
                      kind: "empty",
                      ...(p.copy.language === "en"
                        ? {
                            title: narrowed(input.order)
                              ? `No ${named.singular} matches`
                              : `No ${named.plural} yet`,
                          }
                        : {}),
                      ...(input.canCreate && !narrowed(input.order)
                        ? {
                            action: {
                              intent: "next",
                              control: {
                                id: "new",
                                label:
                                  p.copy.language === "en"
                                    ? `New ${named.singular}`
                                    : `${p.copy.gallery.add}: ${entry.entity}`,
                                tone: "primary",
                                state: "ready",
                              },
                            },
                          }
                        : {}),
                    },
                    p,
                  ),
                ),
              };
    const filters: readonly Filter[] = input.ordering
      ? filterFields(entry).map((field) => {
          const choices = [
            { id: "any", label: p.copy.kit.clear, value: "", enabled: true },
            ...(field.enum ?? []).map((value) => ({
              id: `value:${value}`,
              label: enumLabel(field, value),
              value,
              enabled: true,
            })),
          ];
          return {
            id: field.name,
            field: field.name,
            label: fieldLabel(field),
            choices,
            selectedId:
              choices.find((c) => c.value === (input.order.filters[field.name] ?? ""))?.id ??
              "missing",
            required: true,
          };
        })
      : [];
    const sortChoices = sortOptions(entry).map((option, i) => ({
      id: `sort:${i}`,
      label: option.label,
      value: option.value,
      enabled: true,
    }));
    const result = v.take(
      deriveDataList(
        {
          content,
          order: input.order,
          filters,
          ...(input.ordering
            ? {
                sort: {
                  id: "sort",
                  label: p.copy.kit.sort,
                  choices: sortChoices,
                  selectedId:
                    sortChoices.find((c) => c.value === input.order.sort)?.id ?? "missing",
                  required: true,
                },
              }
            : {}),
          views: [],
          viewDirty: false,
          selection: "none",
          selectedIds: [],
          collapsedIds: [],
          bulkActions: [],
          page: { more: input.more, loading: input.loading },
          total: input.total,
        },
        p,
      ),
    );
    return result;
  });
}
