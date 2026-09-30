// Shared composition spacing; every distance and colour remains theme-owned.
import { StyleSheet } from "react-native";
import type { Theme } from "./theme";
export const kitStyles = (t: Theme) =>
  StyleSheet.create({
    stack: { gap: t.space.md },
    row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: t.space.sm },
    panel: {
      gap: t.space.md,
      padding: t.space.lg,
      backgroundColor: t.color.surfacePrimary,
      borderColor: t.color.borderDefault,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: t.radius.lg,
    },
    grow: { flex: 1 },
    header: { padding: t.space.lg, gap: t.space.sm },
    footer: {
      padding: t.space.lg,
      gap: t.space.sm,
      backgroundColor: t.color.surfacePrimary,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: t.color.borderDefault,
    },
    selected: { borderColor: t.color.focus, borderWidth: t.extent.focus },
    image: { width: "100%", overflow: "hidden", backgroundColor: t.color.surfaceMuted },
    chart: { height: t.extent.chart, width: "100%" },
    column: { minWidth: t.extent.calendarDay, flex: 1 },
  });
