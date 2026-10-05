// DataTable is the kit's one grid: a caption that names what it holds, a header
// that names every column, and one row per record. A figure keeps the column's
// right edge, so the digits of one row sit under the digits of the next and the
// `numeric` role's tabular figures keep the columns straight; words keep the left
// edge. The grid roles belong to the web's accessibility tree, where a table is
// walked cell by cell; a phone reads one row at a time, so each row is one
// focusable element that says its column names and its values aloud.
import React from "react";
import { StyleSheet, View, type AccessibilityRole } from "react-native";
import type { TableModel } from "../../core/derive";
import { Text } from "../atoms/Text";
import { useStyles, type Theme } from "../theme";

export interface Props {
  readonly model: TableModel;
  readonly testID?: string;
}

/**
 * gridRole names the web's table roles. React Native's prop type lists the roles
 * a native platform maps and nothing else, so the grid's own roles are said here
 * once, and a platform that has no mapping for one ignores it rather than
 * misreading it as something it is not.
 */
const gridRole = (role: string): AccessibilityRole => role as AccessibilityRole;

/** sentence reads a row aloud: each column's name, then the value under it. */
const sentence = (model: TableModel, row: TableModel["rows"][number]): string =>
  row.cells
    .map((cell) => {
      const column = model.columns.find((c) => c.id === cell.columnId);
      return `${column?.label ?? cell.columnId}: ${cell.absent ? "—" : cell.text}`;
    })
    .join(", ");

export function DataTable({ model, testID }: Props) {
  const s = useStyles(styles);
  return (
    <View style={s.table} accessibilityLabel={model.caption} testID={testID ?? model.testID}>
      <View style={s.head} accessibilityRole={gridRole("row")}>
        {model.columns.map((column) => (
          <View
            key={column.id}
            style={[s.cell, column.figure ? s.figure : s.word]}
            accessibilityRole={gridRole("columnheader")}
          >
            <Text role="label" weight="semibold" align={column.figure ? "right" : "left"}>
              {column.label}
            </Text>
          </View>
        ))}
      </View>
      {model.rows.map((row) => (
        <View
          key={row.id}
          style={s.row}
          accessible
          accessibilityRole={gridRole("row")}
          accessibilityLabel={sentence(model, row)}
          testID={`${model.testID}-row-${row.id}`}
        >
          {row.cells.map((cell) => (
            <View
              key={cell.columnId}
              style={[s.cell, cell.align === "right" ? s.figure : s.word]}
              accessibilityRole={gridRole("cell")}
            >
              <Text role="numeric" align={cell.align} tone={cell.absent ? "muted" : "primary"}>
                {cell.absent ? "—" : cell.text}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    table: {
      gap: t.space.xs,
      paddingVertical: t.space.sm,
      backgroundColor: t.color.surfacePrimary,
      borderColor: t.color.borderDefault,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: t.radius.lg,
    },
    head: {
      flexDirection: "row" as const,
      gap: t.space.sm,
      paddingHorizontal: t.space.lg,
      paddingBottom: t.space.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: t.color.borderDefault,
    },
    /**
     * A row of a table is a thing a finger is aimed at on a phone, so it takes the
     * height the kit sets for anything a finger presses rather than the height of
     * the one line inside it: rows then sit at a rhythm a person can scan down and
     * still land on, and the figures keep the column's edge.
     */
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: t.space.sm,
      paddingHorizontal: t.space.lg,
      minHeight: t.hit,
    },
    cell: { flex: 1, minWidth: t.extent.chartAxis },
    word: { alignItems: "flex-start" as const },
    figure: { alignItems: "flex-end" as const },
  });
