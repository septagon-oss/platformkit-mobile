// TabBar is the phone's set of destinations: two to five places, icon over
// label, floating above the content and inside the safe area. It names no
// route and owns no navigator — a screen says which tab is selected and what
// selecting another one means, the way every other control in this kit works.
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { TabsModel } from "../../core/navigation";
import { testable } from "../props";
import { Icon, type IconName } from "../atoms/Icon";
import { Text } from "../atoms/Text";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly model: TabsModel;
  readonly onSelect: (id: string) => void;
  /** icons names each destination in the same order as the model's items. */
  readonly icons?: readonly IconName[];
  /** insets is what the device asks back for: the safe area under the bar. */
  readonly insets?: { readonly bottom: number; readonly top?: number };
  /** raised is the bar floating over the content rather than ending the page. */
  readonly raised?: boolean;
  readonly testID?: string;
}

export function TabBar({
  model,
  onSelect,
  icons = [],
  insets = { bottom: 0 },
  raised = true,
  testID,
}: Props) {
  const s = useStyles(styles);
  const [hovered, setHovered] = useState<string | undefined>();
  const [focused, setFocused] = useState<string | undefined>();
  return (
    // Not `accessible`: a container marked so becomes one element on iOS and the
    // tabs inside it stop being reachable one by one, which is the whole point of
    // the bar. The role and its label stay; the tabs keep their own elements.
    <View
      accessibilityRole="tablist"
      accessibilityLabel={model.label}
      style={[s.bar, raised && s.float, { paddingBottom: insets.bottom }]}
      {...testable(testID)}
    >
      {model.items.map((item, i) => (
        <Pressable
          key={item.id}
          onPress={() => {
            if (!item.selected) onSelect(item.id);
          }}
          onHoverIn={() => setHovered(item.id)}
          onHoverOut={() => setHovered(undefined)}
          onFocus={() => setFocused(item.id)}
          onBlur={() => setFocused(undefined)}
          accessibilityRole="tab"
          accessibilityState={{ selected: item.selected }}
          accessibilityLabel={item.badge ? `${item.label}, ${item.badge}` : item.label}
          accessibilityActions={item.selected ? [] : [{ name: "activate", label: item.label }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "activate" && !item.selected) onSelect(item.id);
          }}
          {...testable(`${testID ?? "tab-bar"}:${item.id}`)}
          style={({ pressed }) => [
            s.item,
            hovered === item.id && !item.selected && s.hover,
            pressed && s.press,
            item.selected && s.selected,
            focused === item.id && s.focused,
          ]}
        >
          {icons[i] ? (
            <Icon name={icons[i]!} size="md" tone={item.selected ? "accent" : "muted"} />
          ) : null}
          <Text
            role="caption"
            weight={item.selected ? "semibold" : "regular"}
            tone={item.selected ? "primary" : "muted"}
            numberOfLines={1}
          >
            {item.label}
          </Text>
          {item.badge ? (
            <View style={s.badge}>
              <Text role="caption" weight="semibold" tone="on" style={s.badgeText}>
                {item.badge}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "stretch",
      backgroundColor: t.color.surfacePrimary,
      borderTopWidth: 1,
      borderTopColor: t.state.divider,
      minHeight: t.extent.tabBar,
    },
    float: { ...t.state.raised },
    item: {
      flex: 1,
      minHeight: t.hit,
      alignItems: "center",
      justifyContent: "center",
      gap: t.space.xs / 2,
      paddingVertical: t.space.xs,
      borderWidth: t.extent.focus,
      borderColor: t.color.surfacePrimary,
    },
    hover: { backgroundColor: t.state.hovered },
    press: { backgroundColor: t.state.pressed },
    selected: { backgroundColor: t.state.selected },
    focused: {
      borderColor: t.color.focus,
      outlineColor: t.color.focus,
      outlineWidth: t.extent.focus,
      outlineOffset: -(t.extent.focus + t.space.xs / 2),
    },
    badge: {
      position: "absolute",
      top: t.space.xs,
      right: t.space.md,
      minWidth: t.icon.sm,
      paddingHorizontal: t.space.xs,
      borderRadius: t.radius.full,
      backgroundColor: t.color.accentDefault,
    },
    badgeText: { textAlign: "center" },
  });
