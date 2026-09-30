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
    imageFill: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
    concealed: { opacity: 0 },
    chart: { height: t.extent.chart, width: "100%" },
    chartAxis: { height: t.extent.chart, width: t.extent.chartAxis },
    chartPlot: { flexDirection: "row", gap: t.space.sm, alignItems: "stretch" },
    chartTicks: { flexDirection: "row", justifyContent: "space-between", gap: t.space.sm },
    column: { minWidth: t.extent.calendarDay, flex: 1 },
  });
