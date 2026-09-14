// ListScreen is the chrome every list shares: the native list view under a
// large title, pull to refresh, the foot that loads more, the empty state,
// and skeleton rows before the first page. What a row is comes from the
// caller.
import React, { type ReactElement, type ReactNode } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Skeleton } from "../atoms/Skeleton";
import { useStyles, useTheme, type Theme } from "../theme";
import { useCanvas } from "./canvas";

interface Props<T> {
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
      ListEmptyComponent={loading ? <Skeleton lines={6} /> : <>{empty}</>}
      {...(testID ? { testID } : {})}
    />
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    header: { gap: t.space.lg },
  });
