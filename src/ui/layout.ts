// Shared composition spacing; every distance and colour remains theme-owned.
import { StyleSheet } from "react-native";
import { Platform } from "react-native";
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
    viewport: { flex: 1, overflow: "hidden" },
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
    // A tick label sits on its tick, not below it: half a caption line lifts it
    // so the value is level with the mark it names rather than starting there.
    chartTick: {
      position: "absolute",
      right: 0,
      transform: [{ translateY: -t.type.caption.line / 2 }],
    },
    // The line a bar is measured from spans the whole plot, gaps between the
    // category columns included, which is why it is drawn over them, not in them.
    chartBaseline: {
      position: "absolute",
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.color.textMuted,
    },
    chartColumn: { flex: 1, height: "100%", flexDirection: "row" },
    chartLabels: { flexDirection: "row", gap: t.space.sm, paddingTop: t.space.sm },
    // A browser is where a kit is looked at, and a sheet opened there is a phone's
    // surface on a desk: it keeps a phone's column and lets the canvas show around
    // it, the way every specimen in the gallery does. Left unbounded it stretched
    // its own rows across the whole desktop — a full-width close control over an
    // empty canvas. On a device the sheet is the system's (iOS draws a partial
    // sheet, Android gives it the screen), so nothing is imposed there.
    sheetColumn:
      Platform.OS === "web"
        ? { maxWidth: t.extent.pageColumn, width: "100%", alignSelf: "center" }
        : {},
    column: { minWidth: t.extent.calendarDay, flex: 1 },
  });
