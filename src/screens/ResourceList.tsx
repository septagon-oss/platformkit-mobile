// ResourceList is the generated list screen: the hook that loads it, the
// native header with what a caller may do, and the organism that draws it.
import { Stack, useRouter } from "expo-router";
import { useFeedback } from "./useFeedback";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { doors, type Command } from "../core/catalog";
import { collectionCommands, humanize, plural, screenPath } from "../core/derive";
import type { ScreenProps } from "../renderers";
import { Button } from "../ui/atoms/Button";
import { ResourceList as ResourceListView } from "../ui/organisms/ResourceList";
import { useCommandAsk } from "./useCommand";
import { useResourceList } from "./useResourceList";

export function ResourceList({ entry }: ScreenProps) {
  const feedback = useFeedback();
  const list = useResourceList(entry, feedback);
  const { ask, busy } = useCommandAsk(entry, undefined);
  const router = useRouter();
  const at = screenPath(entry);
  const open = (id: string) => router.push(`${at}/${encodeURIComponent(id)}`);
  const add = useCallback(() => router.push(`${at}/new`), [router, at]);
  const { toggleOrdering } = list;
  // New is drawn when this caller may write *and* the server mounted a create
  // for the resource; one gate is not enough and neither is drawn alone. The
  // plain boolean is what the header memo below depends on: `doors` answers a
  // fresh object each render, which is the fresh instruction that stops the
  // navigator settling.
  const mayCreate = doors(entry).create;
  // The same two shapes as a record's commands: one with an argument opens a
  // sheet, one without is a question. The sheet's path has no row in it,
  // which is the whole of what "about the collection" means.
  const commands = collectionCommands(entry);
  const run = useCallback(
    (c: Command) => {
      if (c.fields.length === 0) return ask(c);
      router.push(`${at}/run/${encodeURIComponent(c.verb)}`);
    },
    [ask, router, at],
  );
  // The options are memoised because the navigator is told them on every
  // render: a fresh object, with fresh callbacks in it, is a new instruction
  // each time and the renders never settle.
  const options = useMemo(
    () => ({
      title: humanize(plural(entry.entity)),
      headerRight: () => (
        <View style={styles.actions}>
          <Button placement="header" label="Order" icon="sort" onPress={toggleOrdering} />
          {mayCreate ? <Button placement="header" label="New" icon="add" onPress={add} /> : null}
        </View>
      ),
    }),
    [entry.entity, mayCreate, toggleOrdering, add],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <ResourceListView
        presentation={{ ...feedback, weekStartsOn: 1 }}
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
        {...(mayCreate ? { onNew: add } : {})}
        {...(commands.length > 0 ? { actions: { commands, running: busy, onRun: run } } : {})}
      />
    </>
  );
}

// The header's two buttons sit side by side; a layout, not a distance, so it
// needs no theme.
const styles = StyleSheet.create({ actions: { flexDirection: "row" } });
