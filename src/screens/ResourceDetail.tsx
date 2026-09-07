// ResourceDetail is the generated detail screen: the hook that reads the row,
// the native header titled by the row's own name with Edit for a caller who
// may, and the organism that draws it.
import { Stack, useRouter } from "expo-router";
import React from "react";
import { label, screenPath } from "../core/derive";
import type { ScreenProps } from "../renderers";
import { Button } from "../ui/atoms/Button";
import { ResourceDetail as ResourceDetailView } from "../ui/organisms/ResourceDetail";
import { useResourceDetail } from "./useResourceDetail";

export function ResourceDetail({ entry, id }: ScreenProps) {
  const detail = useResourceDetail(entry, id);
  const router = useRouter();
  const may = entry.writable && !!id;
  const edit = () => id && router.push(`${screenPath(entry)}/${encodeURIComponent(id)}/edit`);
  return (
    <>
      <Stack.Screen
        options={{
          title: detail.row ? label(entry, detail.row) : "",
          headerLargeTitleEnabled: false,
          ...(may
            ? {
                headerRight: () => (
                  <Button placement="header" label="Edit" icon="edit" onPress={edit} />
                ),
              }
            : {}),
        }}
      />
      <ResourceDetailView
        entry={entry}
        row={detail.row}
        error={detail.error}
        onRetry={detail.reload}
        {...(may ? { onDelete: detail.remove } : {})}
      />
    </>
  );
}
