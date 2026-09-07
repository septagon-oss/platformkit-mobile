// ResourceCommand is a lifecycle command that takes an argument: the same
// sheet a form is, with the command's own controls in it and its own verb on
// the button. Everything about it comes from the catalog — the title, the
// controls, the help under each — so a module that adds a command gets a
// screen without anybody writing one.
import { Stack } from "expo-router";
import React, { useMemo } from "react";
import { commandOf, commandTitle, humanize } from "../core/derive";
import type { ScreenProps } from "../renderers";
import { Notice } from "../ui/atoms/Notice";
import { Button } from "../ui/atoms/Button";
import { ResourceForm as ResourceFormView } from "../ui/organisms/ResourceForm";
import { Screen } from "../ui/templates/Screen";
import { useCommandForm } from "./useCommand";

export function ResourceCommand({ entry, id, verb = "" }: ScreenProps) {
  const command = commandOf(entry, verb);
  if (!command) return <Missing entity={entry.entity} verb={verb} />;
  return <Sheet entry={entry} id={id} command={command} />;
}

function Missing({ entity, verb }: { readonly entity: string; readonly verb: string }) {
  return (
    <Screen>
      <Notice text={`${entity} has no ${verb || "such"} command, or you may not run it.`} />
    </Screen>
  );
}

function Sheet({
  entry,
  id,
  command,
}: {
  readonly entry: ScreenProps["entry"];
  readonly id: string | undefined;
  readonly command: NonNullable<ReturnType<typeof commandOf>>;
}) {
  const form = useCommandForm(entry, id, command);
  const running = form.phase === "running";
  const { cancel, run, phase } = form;
  // The sheet is titled with the command's own summary and confirmed with its
  // verb: a header button is a word, not a sentence. The layout has already
  // put the verb up there, so the title only ever grows into itself.
  const title = commandTitle(command);
  const verb = humanize(command.verb.replace(/-/g, " "));
  // Memoised for the reason every screen's options are: a fresh object with
  // fresh callbacks in it is a new instruction on every render.
  const options = useMemo(
    () => ({
      title,
      gestureEnabled: !running,
      headerLeft: () => (
        <Button placement="header" label="Cancel" onPress={cancel} disabled={running} />
      ),
      headerRight: () => (
        <Button
          placement="header"
          label={verb}
          onPress={() => void run()}
          busy={running}
          disabled={phase !== "editing"}
          testID="run"
        />
      ),
    }),
    [title, verb, running, phase, cancel, run],
  );

  return (
    <>
      <Stack.Screen options={options} />
      <ResourceFormView
        controls={form.controls}
        held={form.held}
        errors={form.errors}
        detail={form.detail}
        phase={running ? "saving" : "editing"}
        onChange={form.change}
        onRetry={cancel}
      />
    </>
  );
}
