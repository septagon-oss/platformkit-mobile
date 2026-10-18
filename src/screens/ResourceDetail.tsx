// ResourceDetail is the generated detail screen: the hook that reads the row,
// the native header titled by the row's own name with Edit for a caller who
// may, and the organism that draws it.
import { Stack, useRouter } from "expo-router";
import { useFeedback } from "./useFeedback";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { doors } from "../core/catalog";
import {
  deriveDisclosure,
  deriveEventActivity,
  deriveOffline,
  pointerTargets,
  recordHeader,
  rowCommands,
  screenPath,
  type Presentation,
} from "../core/derive";
import type { ScreenProps } from "../renderers";
import { Button } from "../ui/atoms/Button";
import { ResourceDetail as ResourceDetailView } from "../ui/organisms/ResourceDetail";
import { useActivity } from "./useActivity";
import { RichTextBody } from "./RichTextBody";
import { useCommandRun } from "./useCommand";
import { useResourceDetail } from "./useResourceDetail";
import { visiblePictures, eventPictures } from "../core/derive";
import { usePictures } from "./usePictures";
import { useRecordPeople } from "./useReferenceNames";

export function ResourceDetail({ entry, id }: ScreenProps) {
  const feedback = useFeedback();
  const presentation: Presentation = { ...feedback, weekStartsOn: 1 };
  const detail = useResourceDetail(entry, id, feedback);
  const activity = useActivity(entry, id);

  // A row this phone answered rather than the server says so, in the same words a
  // list uses: deriveOffline is that sentence's only owner.
  const offline =
    detail.savedAt === undefined ? undefined : deriveOffline(detail.savedAt, presentation);
  const { run, busy } = useCommandRun(entry, id);
  const router = useRouter();
  // Edit and Delete are separate doors: a resource may mount PATCH without
  // DELETE, and a caller who may amend a row may not be one who may erase it.
  const may = doors(entry);
  const canEdit = !!id && may.update;
  const canDelete = !!id && may.delete;
  const edit = useCallback(
    () => id && router.push(`${screenPath(entry)}/${encodeURIComponent(id)}/edit`),
    [router, entry, id],
  );
  // A command with an argument is a sheet of its own; one without is a
  // question the platform asks here. useCommandRun is that rule, shared with
  // every renderer pack that draws a record's actions.
  const commands = rowCommands(entry);
  // The record's own screen opens on what it is, so the header is read from the
  // same answer the body is drawn from: a row whose schema names nothing to read is
  // titled as what it is, in the words the reader's bundle holds, and the noun comes
  // from the catalogue.
  // The records this one points at are named by the same read that names a
  // trail's actors, and the answer is threaded through every derivation below so
  // a pointer reads as a person and never as the identifier stored for it.
  const asked = useMemo(
    () => pointerTargets(entry, detail.row === undefined ? [] : [detail.row], "record"),
    [entry, detail.row],
  );
  const { names, people } = useRecordPeople(asked, detail.visit);
  const [informationOpen, setInformationOpen] = useState(false);
  const media = usePictures(
    [
      ...visiblePictures(
        entry,
        detail.row ? [detail.row] : [],
        people,
        "detail",
        feedback,
        informationOpen,
      ),
      ...(detail.row ? eventPictures(activity) : []),
    ],
    detail.visit,
  );
  const activityModel = deriveEventActivity(
    { ...activity, images: media.enabled, pictureStates: media.states },
    presentation,
  );
  const header = detail.row
    ? recordHeader(entry, detail.row, feedback, feedback.copy.kit.untitled, names)
    : undefined;
  const title = header?.title ?? "";
  // The collapsed Record information block is a disclosure, and a disclosure's open
  // state is the screen's. Its words come from the reader's bundle; what it holds is
  // the section model's.
  const information = useMemo(
    () =>
      deriveDisclosure(
        {
          id: "record-information",
          title: feedback.copy.kit.recordInformation,
          summary: feedback.copy.kit.recordInformationHolds,
          reveals: feedback.copy.kit.recordInformationContent,
          expanded: informationOpen,
          depth: 1,
          enabled: true,
        },
        { ...feedback, weekStartsOn: 1 },
      ),
    [feedback, informationOpen],
  );
  // The options are memoised because the navigator is told them on every
  // render: a fresh object, with fresh callbacks in it, is a new instruction
  // each time and the renders never settle. That is why the dependency is the
  // word the button carries and not the `feedback` object around it, which
  // `useFeedback` rebuilds — with a new reading of the clock — on every render.
  const moreOptions = feedback.copy.kit.moreOptions;
  const options = useMemo(
    () => ({
      title,
      headerLargeTitleEnabled: false,
      // Both sides of the door are spelled out, as Singleton does: a native
      // stack keeps the option it was last given, so *omitting* headerRight is
      // how an Edit that no longer belongs — a withdrawn write, a re-read
      // catalogue handing this screen an entry with no `update` — sits in the
      // header greyed and doing nothing. An empty block is the refusal that
      // actually shows.
      headerRight:
        canEdit || canDelete
          ? () => (
              <View style={styles.actions}>
                {canEdit ? (
                  <Button placement="header" label="Edit" icon="edit" onPress={edit} />
                ) : null}
                {canDelete ? (
                  <Button
                    placement="header"
                    label={moreOptions}
                    icon="more"
                    expanded={detail.menu}
                    onPress={detail.toggleMenu}
                    testID="record-menu"
                  />
                ) : null}
              </View>
            )
          : () => null,
    }),
    [title, canEdit, canDelete, edit, moreOptions, detail.menu, detail.toggleMenu],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <ResourceDetailView
        feedback={feedback}
        entry={entry}
        row={detail.row}
        names={names}
        people={people}
        pictureStates={media.states}
        {...(media.enabled ? { renderImage: media.renderImage } : {})}
        error={detail.error}
        saved={detail.saved}
        {...(detail.refusal ? { refusal: detail.refusal } : {})}
        onRetry={detail.reload}
        {...(offline?.ok ? { offline: offline.value } : {})}
        onDismiss={detail.dismiss}
        onBack={detail.leave}
        menuOpen={detail.menu}
        {...(information.ok
          ? { information: { model: information.value, onExpanded: setInformationOpen } }
          : {})}
        {...(activityModel.ok
          ? {
              activity: {
                model: activityModel.value,
                ...(media.enabled ? { renderImage: media.renderImage } : {}),
                onMore: activity.loadMore,
                onRetry: activity.reload,
              },
            }
          : {})}
        {...(commands.length > 0 ? { actions: { commands, running: busy, onRun: run } } : {})}
        {...(canDelete ? { onDelete: detail.remove } : {})}
        // A rich text body is read, not printed: the reader is supplied here because it is
        // this screen that can ask for a figure's file, and the organism that decides
        // which field is one (derive.richBody).
        richText={(body, testID, fallback) => (
          <RichTextBody
            presentation={presentation}
            source={body}
            testID={testID}
            fallback={fallback}
          />
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: "row" } });
