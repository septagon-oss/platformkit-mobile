// ListScreen is the chrome every list shares: the native list view under a
// large title, pull to refresh, the foot that loads more, the empty state,
// and skeleton rows before the first page. What a row is comes from the
// caller.
import React, { type ReactElement, type ReactNode } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "../atoms/Skeleton";
import { useStyles, useTheme, type Theme } from "../theme";

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
  const insets = useSafeAreaInsets();
  return (
    <FlatList
      data={data}
      keyExtractor={keyOf}
      renderItem={({ item }) => render(item)}
      style={s.list}
      contentContainerStyle={[s.content, { paddingBottom: insets.bottom + t.space.xl }]}
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
    list: { flex: 1, backgroundColor: t.color.surfaceCanvas },
    content: { padding: t.space.lg, gap: t.space.lg },
    header: { gap: t.space.lg },
  });
