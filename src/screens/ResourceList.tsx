// ResourceList is the generated list screen: the hook that loads it, the
// native header with what a caller may do, and the organism that draws it.
import { Stack, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { humanize, screenPath } from "../core/derive";
import type { ScreenProps } from "../renderers";
import { Button } from "../ui/atoms/Button";
import { ResourceList as ResourceListView } from "../ui/organisms/ResourceList";
import { useResourceList } from "./useResourceList";

export function ResourceList({ entry }: ScreenProps) {
  const list = useResourceList(entry);
  const router = useRouter();
  const at = screenPath(entry);
  const open = (id: string) => router.push(`${at}/${encodeURIComponent(id)}`);
  const add = () => router.push(`${at}/new`);
  return (
    <>
      <Stack.Screen
        options={{
          title: humanize(entry.entity) + "s",
          headerRight: () => (
            <View style={{ flexDirection: "row" }}>
              <Button placement="header" label="Order" icon="sort" onPress={list.toggleOrdering} />
              {entry.writable ? (
                <Button placement="header" label="New" icon="add" onPress={add} />
              ) : null}
            </View>
          ),
        }}
      />
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
