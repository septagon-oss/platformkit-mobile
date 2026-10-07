// ResourceDetail is the generated detail screen: the hook that reads the row,
// the native header titled by the row's own name with Edit for a caller who
// may, and the organism that draws it.
import { Stack, useRouter } from "expo-router";
import { useFeedback } from "./useFeedback";
import React, { useCallback, useMemo } from "react";
import { doors } from "../core/catalog";
import { deriveEventActivity, label, rowCommands, screenPath } from "../core/derive";
import type { ScreenProps } from "../renderers";
import { Button } from "../ui/atoms/Button";
import { ResourceDetail as ResourceDetailView } from "../ui/organisms/ResourceDetail";
import { systemClock } from "./clock";
import { useActivity } from "./useActivity";
import { useCommandRun } from "./useCommand";
import { useResourceDetail } from "./useResourceDetail";

export function ResourceDetail({ entry, id }: ScreenProps) {
  const feedback = useFeedback();
  const detail = useResourceDetail(entry, id);
  const activity = useActivity(entry, id);
  const activityModel = deriveEventActivity(activity, {
    ...feedback,
    now: systemClock.now(),
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
  const title = detail.row ? label(entry, detail.row) : "";
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
      headerRight: canEdit
        ? () => <Button placement="header" label="Edit" icon="edit" onPress={edit} />
        : () => null,
    }),
    [title, canEdit, edit],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <ResourceDetailView
        feedback={feedback}
        entry={entry}
        row={detail.row}
        error={detail.error}
        onRetry={detail.reload}
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
