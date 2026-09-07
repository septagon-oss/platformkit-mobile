// ResourceDetail is the generated detail screen: the hook that reads the row,
// the native header titled by the row's own name with Edit for a caller who
// may, and the organism that draws it.
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { label, screenPath } from "../core/derive";
import type { ScreenProps } from "../renderers";
import { Button } from "../ui/atoms/Button";
import { ResourceDetail as ResourceDetailView } from "../ui/organisms/ResourceDetail";
import { useActivity } from "./useActivity";
import { useResourceDetail } from "./useResourceDetail";

export function ResourceDetail({ entry, id }: ScreenProps) {
  const detail = useResourceDetail(entry, id);
  const activity = useActivity(entry, id);
  const router = useRouter();
  const may = entry.writable && !!id;
  const edit = useCallback(
    () => id && router.push(`${screenPath(entry)}/${encodeURIComponent(id)}/edit`),
    [router, entry, id],
  );
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
        {...(may ? { onDelete: detail.remove } : {})}
      />
    </>
  );
}
