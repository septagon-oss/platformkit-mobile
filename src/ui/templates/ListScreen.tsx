// ListScreen is the chrome every list shares: the native list view under a
// large title, pull to refresh, the foot that loads more, the empty state,
// and skeleton rows before the first page. What a row is comes from the
// caller.
import type { Feedback } from "../../core/derive";
import React, { type ReactElement, type ReactNode } from "react";
import { FlatList, SectionList, RefreshControl, StyleSheet, View } from "react-native";
import { Skeleton } from "../atoms/Skeleton";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";
import { useCanvas } from "./canvas";

interface Props<T> {
  readonly feedback: Feedback;
  readonly data: readonly T[];
  readonly keyOf: (item: T) => string;
  readonly render: (item: T) => ReactElement;
  /** loading is the first page on its way: skeleton rows instead of an empty state. */
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
  readonly onEndReached?: () => void;
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly empty: ReactNode;
  readonly testID?: string;
}

export function ListScreen<T>({
  feedback,
  data,
  keyOf,
  render,
  loading,
  refreshing,
  onRefresh,
  onEndReached,
  header,
  footer,
  empty,
  testID,
}: Props<T>) {
  const t = useTheme();
  const s = useStyles(styles);
  const canvas = useCanvas();
  return (
    <FlatList
      data={data}
      keyExtractor={keyOf}
      renderItem={({ item }) => render(item)}
      style={canvas.page}
      contentContainerStyle={canvas.content}
      // What makes the rows start under the native header and the large title
      // collapse as they scroll.
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={t.color.accentDefault}
        />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={header ? <View style={s.header}>{header}</View> : null}
      ListFooterComponent={footer ? <>{footer}</> : null}
      ListEmptyComponent={
        loading ? (
          <Skeleton
            label={feedback.loadingLabel}
            motion={feedback.motion}
            variant="rows"
            lines={6}
          />
        ) : (
          <>{empty}</>
        )
      }
      {...testable(testID)}
    />
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    header: { gap: t.space.lg },
  });

/** Grouped lists retain virtualization in the same native list owner. */
export function GroupedListScreen<T>({
  sections,
  keyOf,
  render,
  renderHeading,
  header,
  footer,
  empty,
  refreshing,
  onRefresh,
  testID,
}: {
  readonly sections: readonly { readonly id: string; readonly data: readonly T[] }[];
  readonly keyOf: (item: T) => string;
  readonly render: (item: T) => ReactElement;
  readonly renderHeading: (id: string) => ReactElement;
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly empty?: ReactNode;
  readonly refreshing: boolean;
  readonly onRefresh?: () => void;
  readonly testID?: string | undefined;
}) {
  const t = useTheme(),
    canvas = useCanvas();
  return (
    <SectionList
      sections={sections}
      keyExtractor={keyOf}
      renderItem={({ item }) => render(item)}
      renderSectionHeader={({ section }) => renderHeading(section.id)}
      style={canvas.page}
      contentContainerStyle={canvas.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
      {...(onRefresh
        ? {
            refreshControl: (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={t.color.accentDefault}
              />
            ),
          }
        : {})}
      ListHeaderComponent={<>{header}</>}
      ListFooterComponent={<>{footer}</>}
      ListEmptyComponent={<>{empty}</>}
      {...testable(testID)}
    />
  );
}
