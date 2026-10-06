// Singleton is the screen for a resource a tenant has exactly one of: the
// record, and its own form in place of it. There is no list above it, no New
// and no Delete, because the API it stands in front of has no route for any of
// those — which is what the catalog's singleton flag says.
import { Stack } from "expo-router";
import { useFeedback } from "./useFeedback";
import React, { useMemo } from "react";
import { doors } from "../core/catalog";
import { humanize, type Clock } from "../core/derive";
import type { ScreenProps } from "../renderers";
import { Button } from "../ui/atoms/Button";
import { ResourceDetail } from "../ui/organisms/ResourceDetail";
import { ResourceForm } from "../ui/organisms/ResourceForm";
import { useSingleton } from "./useSingleton";
import { systemClock, useInitialDate } from "./clock";

export function Singleton({
  entry,
  clock = systemClock,
}: ScreenProps & { readonly clock?: Clock }) {
  const feedback = useFeedback();
  const initialDate = useInitialDate(clock);
  const one = useSingleton(entry);
  const { edit, cancel, save, editing, phase } = one;
  // A singleton writes its one row with a PUT, whose verb the kernel calls
  // update; a singleton prints no operation set today, so this is the answer
  // `entry.writable` always gave and the right one the day one names a set.
  const may = doors(entry).update;
  const saving = phase === "saving";
  // Memoised because the navigator is told its options on every render.
  const options = useMemo(
    () => ({
      title: humanize(entry.entity),
      headerLargeTitleEnabled: !editing,
      // Both sides of every option are spelled out, including the empty ones.
      // A native stack keeps what it was last given, so options that merely
      // omit headerLeft leave the Cancel from the form sitting in the header
      // of the record, greyed and doing nothing.
      headerLeft:
        may && editing
          ? () => <Button placement="header" label="Cancel" onPress={cancel} disabled={saving} />
          : () => null,
      headerRight: !may
        ? () => null
        : editing
          ? () => (
              <Button
                placement="header"
                label="Save"
                onPress={() => void save()}
                busy={saving}
                testID="save"
              />
            )
          : () => <Button placement="header" label="Edit" icon="edit" onPress={edit} />,
    }),
    [entry.entity, may, editing, saving, edit, cancel, save],
  );

  return (
    <>
      <Stack.Screen options={options} />
      {editing ? (
        <ResourceForm
          feedback={feedback}
          initialDate={initialDate}
          controls={one.controls}
          held={one.held}
          errors={one.errors}
          detail={one.detail}
          phase={saving ? "saving" : "editing"}
          onChange={one.change}
          onRetry={one.reload}
        />
      ) : (
        <ResourceDetail
          feedback={feedback}
          entry={entry}
          row={one.row}
          error={phase === "failed" ? one.detail : ""}
          onRetry={() => void one.reload()}
        />
      )}
    </>
  );
}
