// ResourceList is the generated list screen: the hook that loads it, the
// native header with what a caller may do, and the organism that draws it.
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { View } from "react-native";
import { humanize, plural, screenPath } from "../core/derive";
import type { ScreenProps } from "../renderers";
import { Button } from "../ui/atoms/Button";
import { ResourceList as ResourceListView } from "../ui/organisms/ResourceList";
import { useResourceList } from "./useResourceList";

export function ResourceList({ entry }: ScreenProps) {
  const list = useResourceList(entry);
  const router = useRouter();
  const at = screenPath(entry);
  const open = (id: string) => router.push(`${at}/${encodeURIComponent(id)}`);
  const add = useCallback(() => router.push(`${at}/new`), [router, at]);
  const { toggleOrdering } = list;
  // The options are memoised because the navigator is told them on every
  // render: a fresh object, with fresh callbacks in it, is a new instruction
  // each time and the renders never settle.
  const options = useMemo(
    () => ({
      title: humanize(plural(entry.entity)),
      headerRight: () => (
        <View style={{ flexDirection: "row" }}>
          <Button placement="header" label="Order" icon="sort" onPress={toggleOrdering} />
          {entry.writable ? (
            <Button placement="header" label="New" icon="add" onPress={add} />
          ) : null}
        </View>
      ),
    }),
    [entry.entity, entry.writable, toggleOrdering, add],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <ResourceListView
        entry={entry}
        rows={list.rows}
        total={list.total}
        loading={list.loading}
        refreshing={list.refreshing}
        more={list.more}
        error={list.error}
        order={list.order}
        ordering={list.ordering}
        onOrder={list.setOrder}
        onOpen={open}
        onMore={list.loadMore}
        onRefresh={list.refresh}
        {...(entry.writable ? { onNew: add } : {})}
      />
    </>
  );
}
