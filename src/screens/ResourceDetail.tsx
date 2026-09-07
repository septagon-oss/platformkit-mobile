// ResourceDetail is the generated detail screen: the hook that reads the row,
// the native header titled by the row's own name with Edit for a caller who
// may, and the organism that draws it.
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import type { Command } from "../core/catalog";
import { label, rowCommands, screenPath } from "../core/derive";
import type { ScreenProps } from "../renderers";
import { Button } from "../ui/atoms/Button";
import { ResourceDetail as ResourceDetailView } from "../ui/organisms/ResourceDetail";
import { useActivity } from "./useActivity";
import { useCommandAsk } from "./useCommand";
import { useResourceDetail } from "./useResourceDetail";

export function ResourceDetail({ entry, id }: ScreenProps) {
  const detail = useResourceDetail(entry, id);
  const activity = useActivity(entry, id);
  const { ask, busy } = useCommandAsk(entry, id);
  const router = useRouter();
  const may = entry.writable && !!id;
  const edit = useCallback(
    () => id && router.push(`${screenPath(entry)}/${encodeURIComponent(id)}/edit`),
    [router, entry, id],
  );
  // A command with an argument is a sheet of its own; one without is a
  // question the platform asks here.
  const run = useCallback(
    (c: Command) => {
      if (c.fields.length === 0) return ask(c);
      if (id)
        router.push(
          `${screenPath(entry)}/${encodeURIComponent(id)}/run/${encodeURIComponent(c.verb)}`,
        );
    },
    [ask, id, router, entry],
  );
  const commands = rowCommands(entry);
  const title = detail.row ? label(entry, detail.row) : "";
  // The options are memoised because the navigator is told them on every
  // render: a fresh object, with fresh callbacks in it, is a new instruction
  // each time and the renders never settle.
  const options = useMemo(
    () => ({
      title,
      headerLargeTitleEnabled: false,
      ...(may
        ? {
            headerRight: () => (
              <Button placement="header" label="Edit" icon="edit" onPress={edit} />
            ),
          }
        : {}),
    }),
    [title, may, edit],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <ResourceDetailView
        entry={entry}
        row={detail.row}
        error={detail.error}
        onRetry={detail.reload}
        activity={activity}
        {...(commands.length > 0 ? { actions: { commands, running: busy, onRun: run } } : {})}
        {...(may ? { onDelete: detail.remove } : {})}
      />
    </>
  );
}
