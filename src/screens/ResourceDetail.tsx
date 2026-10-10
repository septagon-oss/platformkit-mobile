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
  recordHeader,
  rowCommands,
  screenPath,
} from "../core/derive";
import type { ScreenProps } from "../renderers";
import { Button } from "../ui/atoms/Button";
import { ResourceDetail as ResourceDetailView } from "../ui/organisms/ResourceDetail";
import { useActivity } from "./useActivity";
import { useCommandRun } from "./useCommand";
import { useResourceDetail } from "./useResourceDetail";

export function ResourceDetail({ entry, id }: ScreenProps) {
  const feedback = useFeedback();
  const detail = useResourceDetail(entry, id, feedback);
  const activity = useActivity(entry, id);
  const activityModel = deriveEventActivity(activity, {
    ...feedback,
    weekStartsOn: 1,
  });
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
  const header = detail.row
    ? recordHeader(entry, detail.row, feedback, feedback.copy.kit.untitled)
    : undefined;
  const title = header?.title ?? "";
  // The collapsed Record information block is a disclosure, and a disclosure's open
  // state is the screen's. Its words come from the reader's bundle; what it holds is
  // the section model's.
  const [informationOpen, setInformationOpen] = useState(false);
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
  // each time and the renders never settle.
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
                    label={feedback.copy.kit.moreOptions}
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
    [title, canEdit, canDelete, edit, feedback, detail.menu, detail.toggleMenu],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <ResourceDetailView
        feedback={feedback}
        entry={entry}
        row={detail.row}
        error={detail.error}
        {...(detail.refusal ? { refusal: detail.refusal } : {})}
        onRetry={detail.reload}
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
                onMore: activity.loadMore,
                onRetry: activity.reload,
              },
            }
          : {})}
        {...(commands.length > 0 ? { actions: { commands, running: busy, onRun: run } } : {})}
        {...(canDelete ? { onDelete: detail.remove } : {})}
      />
    </>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: "row" } });
