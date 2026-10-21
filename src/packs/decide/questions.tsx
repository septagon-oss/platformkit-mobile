// QuestionList is the generated list of questions with the one door the entry cannot draw: the
// Decide module mounts `decide/questions` with read and list only, so the entry offers no create,
// the generated header draws no New, and the one thing this resource is for has no door. Opening a
// question stays a service call that takes the whole draft at once — so the door is the list's own
// New action, pointed at this pack's form. Everything else here is the organism's: its rows, its
// states, its order and its pull.
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { noun, pointerTargets, screenPath, visiblePictures } from "../../core/derive";
import { rowAt } from "../../core/reentry";
import type { ScreenProps } from "../../renderers";
import { useFeedback } from "../../screens/useFeedback";
import { usePictures } from "../../screens/usePictures";
import { useResourceList } from "../../screens/useResourceList";
import { useDirectoryPeople } from "../../screens/useReferenceNames";
import { ResourceList } from "../../ui/organisms/ResourceList";

/** QuestionList draws the questions this workspace can read and asks a new one. */
export function QuestionList({ entry }: ScreenProps) {
  const feedback = useFeedback();
  const list = useResourceList(entry, feedback);
  const router = useRouter();
  const ask = useCallback(() => router.push(`${screenPath(entry)}/new`), [router, entry]);
  const open = useCallback(
    (id: string) => router.push(rowAt(entry.module, entry.entity, id)),
    [router, entry],
  );
  const asked = useMemo(() => pointerTargets(entry, list.rows, "row"), [entry, list.rows]);
  const people = useDirectoryPeople(asked, list.visit);
  const media = usePictures(
    visiblePictures(entry, list.rows, people.people, "row", feedback),
    list.visit,
  );
  const options = useMemo(
    () => ({ title: noun(entry).plural, headerLargeTitleEnabled: false }),
    [entry],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <ResourceList
        presentation={{ ...feedback, weekStartsOn: 1 }}
        entry={entry}
        rows={list.rows}
        {...(people.names === undefined ? {} : { names: people.names })}
        people={people.people}
        pictureStates={media.states}
        {...(media.enabled ? { renderImage: media.renderImage } : {})}
        total={list.total}
        loading={list.loading}
        refreshing={list.refreshing}
        more={list.more}
        error={list.error}
        {...(list.savedAt === undefined ? {} : { savedAt: list.savedAt })}
        order={list.order}
        sheet={list.sheet}
        onSheet={list.setSheet}
        onOrder={list.setOrder}
        onOpen={open}
        onMore={list.loadMore}
        onRefresh={list.refresh}
        onNew={ask}
      />
    </>
  );
}
