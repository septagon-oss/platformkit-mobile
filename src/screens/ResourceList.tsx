// ResourceList is the generated list screen: the hook that loads it, the
// native header with what a caller may do, and the organism that draws it.
import { Stack, useRouter } from "expo-router";
import { useFeedback } from "./useFeedback";
import React, { useCallback, useMemo } from "react";
import { doors, type Command } from "../core/catalog";
import {
  collectionCommands,
  noun,
  pointerTargets,
  screenPath,
  visiblePictures,
} from "../core/derive";
import type { ScreenProps } from "../renderers";
import type { LayoutRectangle } from "react-native";
import { Button } from "../ui/atoms/Button";
import { ResourceList as ResourceListView } from "../ui/organisms/ResourceList";
import { useCommandAsk, useRowCommand } from "./useCommand";
import { useResourceList } from "./useResourceList";
import { usePictures } from "./usePictures";
import { useDirectoryPeople } from "./useReferenceNames";
import { useShell } from "../shell";
export function ResourceList({ entry }: ScreenProps) {
  const feedback = useFeedback();
  const list = useResourceList(entry, feedback);
  const { ask, busy } = useCommandAsk(entry, undefined);
  const router = useRouter();
  const at = screenPath(entry);
  // Where the person pressed is filed under the record it opens: that record is the only place
  // the flight can be drawn, and the list is leaving the screen by then. A press this phone never
  // measured files nothing, which is the ordinary push.
  const { travelTo, media: native } = useShell();
  // A row's command is the entry's own declaration, run through the same submit a record's command
  // uses. The surface that uncovers it is the product's, and a product that supplies none is
  // offered the command as an action of the row instead.
  const row = useRowCommand(entry);
  const RowSwipe = native?.rowAction;
  const open = (id: string, frame?: LayoutRectangle) => {
    const href = `${at}/${encodeURIComponent(id)}`;
    if (frame) travelTo(href, frame);
    router.push(href);
  };
  const add = useCallback(() => router.push(`${at}/new`), [router, at]);
  const { sheet, setSheet } = list;
  // A row that points at another record names it: one page of each resource this
  // window points at, which is the same read the trail makes for its actors, and
  // a value outside the page keeps the word rather than quoting an identifier.
  const asked = useMemo(() => pointerTargets(entry, list.rows, "row"), [entry, list.rows]);
  const { names, people } = useDirectoryPeople(asked, list.visit);
  const media = usePictures(visiblePictures(entry, list.rows, people, "row", feedback), list.visit);
  // What the header's one door is called. A string in a frozen bundle, which is what
  // makes it a usable memo dependency below — the `feedback` object around it is
  // fresh every render because it reads the clock.
  const addWord = feedback.copy.kit.new;
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
      title: noun(entry).plural,
      // The header holds the one thing this screen can *do*. How the list is being
      // read — in what order, narrowed how — is the list's own row under the header,
      // where a person is already looking at the list. Two header buttons compete for
      // a thumb at the edge of the screen, and neither says what it currently does.
      headerRight: () =>
        mayCreate ? <Button placement="header" label={addWord} icon="add" onPress={add} /> : null,
    }),
    [entry.entity, mayCreate, addWord, add],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <ResourceListView
        presentation={{ ...feedback, weekStartsOn: 1 }}
        entry={entry}
        rows={list.rows}
        names={names}
        people={people}
        pictureStates={media.states}
        {...(media.enabled ? { renderImage: media.renderImage } : {})}
        total={list.total}
        loading={list.loading}
        refreshing={list.refreshing}
        more={list.more}
        error={list.error}
        {...(list.savedAt === undefined ? {} : { savedAt: list.savedAt })}
        order={list.order}
        sheet={sheet}
        onSheet={setSheet}
        onOrder={list.setOrder}
        onOpen={open}
        onMore={list.loadMore}
        onRefresh={list.refresh}
        onRowRun={row.run}
        {...(RowSwipe ? { renderRowAction: RowSwipe } : {})}
        {...(mayCreate ? { onNew: add } : {})}
        {...(commands.length > 0 ? { actions: { commands, running: busy, onRun: run } } : {})}
      />
    </>
  );
}

// One header door, and it is only there when the caller may write: a layout would
// be a rule about a button that may not be drawn.
