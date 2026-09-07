// ResourceForm is the create and edit sheet: the hook that owns its phase,
// the native header with Cancel and Save, and the organism that draws the
// controls. It is presented as a sheet, and cannot be swiped away while it
// is saving.
import { Stack } from "expo-router";
import React from "react";
import type { ScreenProps } from "../renderers";
import { Button } from "../ui/atoms/Button";
import { ResourceForm as ResourceFormView } from "../ui/organisms/ResourceForm";
import { useResourceForm } from "./useResourceForm";

export function ResourceForm({ entry, id }: ScreenProps) {
  const form = useResourceForm(entry, id);
  const saving = form.phase === "saving";
  return (
    <>
      <Stack.Screen
        options={{
          title: (form.create ? "New " : "Edit ") + entry.entity,
          presentation: "modal",
          headerLargeTitleEnabled: false,
          gestureEnabled: !saving,
          headerLeft: () => (
            <Button placement="header" label="Cancel" onPress={form.cancel} disabled={saving} />
          ),
          headerRight: () => (
            <Button
              placement="header"
              label="Save"
              onPress={() => void form.save()}
              busy={saving}
              disabled={form.phase !== "editing"}
              testID="save"
            />
          ),
        }}
      />
      <ResourceFormView
        controls={form.controls}
        held={form.held}
        errors={form.errors}
        detail={form.detail}
        phase={form.phase}
        onChange={form.change}
        onRetry={form.reload}
      />
    </>
  );
}
