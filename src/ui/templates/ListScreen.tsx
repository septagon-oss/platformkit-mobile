// ListScreen is the chrome every list shares: the native list view under a
// large title, pull to refresh, the foot that loads more, the empty state,
// and skeleton rows before the first page. What a row is comes from the
// caller.
import type { Feedback } from "../../core/derive";
import React, { Fragment, type ReactElement, type ReactNode } from "react";
import { FlatList, RefreshControl, ScrollView, SectionList, StyleSheet, View } from "react-native";
import { Skeleton } from "../atoms/Skeleton";
import { Section } from "../molecules/Section";
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
  /**
   * grouped draws the rows inside one inset card instead of one card per row. The
   * screen that holds the handful of things a person may open — Home and its
   * resources — reads as one group of choices; a list the server pages keeps the
   * virtualised view, which cannot hold one surface across the rows it recycles.
   */
  readonly grouped?: boolean;
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
  grouped = false,
  testID,
}: Props<T>) {
  const t = useTheme();
  const s = useStyles(styles);
  const canvas = useCanvas();
  // What surrounds the rows is named once, so a grouped page and a list cannot
  // grow two different refreshes, empty states or footers.
  const refresh = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={t.color.accentDefault}
    />
  );
  const region = (
    <View style={s.empty}>
      {loading ? (
        <Skeleton label={feedback.loadingLabel} motion={feedback.motion} variant="rows" lines={6} />
      ) : (
        empty
      )}
    </View>
  );
  if (grouped)
    return (
      <ScrollView
        style={canvas.page}
        contentContainerStyle={canvas.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={refresh}
        {...testable(testID)}
      >
        {header ? <View style={s.header}>{header}</View> : null}
        {data.length === 0 ? (
          region
        ) : (
          <Section>
            {data.map((item) => (
              <Fragment key={keyOf(item)}>{render(item)}</Fragment>
            ))}
          </Section>
        )}
        {footer ?? null}
      </ScrollView>
    );
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
      refreshControl={refresh}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={header ? <View style={s.header}>{header}</View> : null}
      ListFooterComponent={footer ? <>{footer}</> : null}
      ListEmptyComponent={region}
      {...testable(testID)}
    />
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    header: { gap: t.space.lg },
    // The empty region keeps the page's rhythm: its elements are the list's, so
    // they are spaced as its rows are.
    empty: { gap: t.space.lg },
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
    s = useStyles(styles),
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
      // The list measures whatever it is given for an empty region, so the region
      // has to be a view: a bare fragment can carry no measurement and React
      // reports an element it cannot hand props to over the page.
      ListEmptyComponent={
        empty === undefined || empty === null ? undefined : <View style={s.empty}>{empty}</View>
      }
      {...testable(testID)}
    />
  );
}
