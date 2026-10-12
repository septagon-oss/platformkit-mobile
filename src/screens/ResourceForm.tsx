// ResourceForm is the create and edit sheet: the hook that owns its phase,
// the native header with Cancel and Save, and the organism that draws the
// controls. It is presented as a sheet, and cannot be swiped away while it
// is saving.
import { Stack } from "expo-router";
import { useFeedback } from "./useFeedback";
import React, { useCallback, useMemo } from "react";
import type { ScreenProps } from "../renderers";
import { Button } from "../ui/atoms/Button";
import { ResourceForm as ResourceFormView } from "../ui/organisms/ResourceForm";
import { useResourceForm } from "./useResourceForm";
import { label, type Clock } from "../core/derive";
import { systemClock, useInitialDate } from "./clock";
import { useShell } from "../shell";
import { choose } from "../ui/chooser";
import { useTheme } from "../ui/theme";

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
  const { api, entry: entryOf } = useShell();
  const { mode } = useTheme();
  const kit = feedback.copy.kit;
  // A figure goes into a body as a file this server already holds: the person chooses among
  // the files this session may read, and the body is given that file's own line. Pointing a
  // camera or uploading a picture from this phone needs a native module this build does not
  // carry (README Limits), so no control here promises one.
  const pickImage = useCallback(
    (field: string, put: (pick: { readonly name: string; readonly file: string }) => void) => {
      const files = entryOf("file", "files");
      if (files === undefined) return;
      void api
        .list(files, { limit: 6 })
        .then((page) => {
          const rows = page.items.slice(0, 6);
          choose(
            kit.imageFromFiles,
            rows.map((row) => {
              const name = label(files, row, kit.untitled, "row");
              return {
                label: name,
                onPress: () => put({ name, file: String(row.id ?? "") }),
              };
            }),
            mode,
            { message: kit.noFilesToInsert },
          );
        })
        .catch(() => undefined);
    },
    [api, entryOf, kit, mode],
  );
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
        onImage={pickImage}
        onFieldRefused={form.fieldRefused}
        onRetry={form.reload}
      />
    </>
  );
}
