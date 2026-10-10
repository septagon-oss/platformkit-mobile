// ResourceForm is the create and edit sheet: the hook that owns its phase,
// the native header with Cancel and Save, and the organism that draws the
// controls. It is presented as a sheet, and cannot be swiped away while it
// is saving.
import { Stack } from "expo-router";
import { useFeedback } from "./useFeedback";
import React, { useMemo } from "react";
import type { ScreenProps } from "../renderers";
import { Button } from "../ui/atoms/Button";
import { ResourceForm as ResourceFormView } from "../ui/organisms/ResourceForm";
import { useResourceForm } from "./useResourceForm";
import type { Clock } from "../core/derive";
import { systemClock, useInitialDate } from "./clock";

export function ResourceForm({
  entry,
  id,
  clock = systemClock,
}: ScreenProps & { readonly clock?: Clock }) {
  const feedback = useFeedback();
  const initialDate = useInitialDate(clock);
  const form = useResourceForm(entry, id);
  const saving = form.phase === "saving";
  const { cancel, save, phase } = form;
  // The options are memoised because the navigator is told them on every
  // render: a fresh object, with fresh callbacks in it, is a new instruction
  // each time and the renders never settle.
  const options = useMemo(
    () => ({
      // The title and the presentation are the layout's, so a sheet is
      // presented with them rather than acquiring them a frame later.
      gestureEnabled: !saving,
      headerLeft: () => (
        <Button placement="header" label="Cancel" onPress={cancel} disabled={saving} />
      ),
      headerRight: () => (
        <Button
          placement="header"
          label="Save"
          onPress={() => void save()}
          busy={saving}
          disabled={phase !== "editing"}
          testID="save"
        />
      ),
    }),
    [saving, phase, cancel, save],
  );

  return (
    <>
      <Stack.Screen options={options} />
      <ResourceFormView
        feedback={feedback}
        initialDate={initialDate}
        blocks={form.blocks}
        held={form.held}
        errors={form.errors}
        detail={form.detail}
        awaiting={form.awaiting}
        refusals={form.refusals}
        phase={form.phase}
        onChange={form.change}
        onFieldRefused={form.fieldRefused}
        onRetry={form.reload}
      />
    </>
  );
}
