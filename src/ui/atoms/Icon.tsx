// Icon is the closed vocabulary of glyphs a screen may use, by what they mean
// rather than what the icon set calls them, the way the web shell's icon
// provider resolves a name. A glyph nobody asks for is a glyph nothing draws.
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import type { IconSize } from "../scale";
import { testable } from "../props";
import type { Status } from "../../core/derive";
import { statusInk, useTheme } from "../theme";
import { toneColor, type Tone } from "./Text";

const glyphs = {
  task: "checkbox-outline",
  people: "people-outline",
  document: "document-text-outline",
  settings: "settings-outline",
  plan: "map-outline",
  folder: "folder-outline",
  chart: "bar-chart-outline",
  message: "chatbubble-outline",
  money: "cash-outline",
  box: "cube-outline",
  tag: "pricetag-outline",
  building: "business-outline",
  location: "location-outline",
  link: "link-outline",
  add: "add",
  // The stepper's two halves: one glyph adds, the other takes one away.
  less: "remove-outline",
  back: "chevron-back",
  calendar: "calendar-outline",
  clock: "time-outline",
  close: "close",
  check: "checkmark",
  chevron: "chevron-forward",
  edit: "create-outline",
  empty: "folder-open-outline",
  more: "ellipsis-horizontal",
  offline: "cloud-offline-outline",
  person: "person-circle-outline",
  // A receipt is what a charge is itemised on: the mark a Billing destination wears.
  receipt: "receipt-outline",
  refresh: "refresh",
  server: "server-outline",
  signOut: "log-out-outline",
  sort: "swap-vertical-outline",
  trash: "trash-outline",
  // A ticket is what an admission is written on: the mark a Passes destination
  // wears so its name is not the only tab in the bar without one.
  ticket: "ticket-outline",
  warning: "alert-circle-outline",
  search: "search",
  home: "home",
  grid: "grid",
  play: "play",
  pause: "pause",
  forward: "play-forward",
  rewind: "play-back",
  circle: "ellipse-outline",
  image: "image-outline",
} as const;

export type IconName = keyof typeof glyphs;
export type { IconSize };

interface Props {
  readonly name: IconName;
  readonly size?: IconSize;
  readonly tone?: Tone;
  readonly status?: Status["tone"];
  /** label makes the icon announce itself; without one it is decoration and hidden from readers. */
  readonly label?: string;
  readonly testID?: string;
}

export function Icon({ name, size = "md", tone = "primary", status, label, testID }: Props) {
  const t = useTheme();
  return (
    <Ionicons
      name={glyphs[name]}
      size={t.icon[size]}
      color={status ? statusInk(t, status) : toneColor(t, tone)}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
      {...(label ? { accessibilityLabel: label } : {})}
      {...testable(testID)}
    />
  );
}
