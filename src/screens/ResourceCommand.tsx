// ResourceCommand is a lifecycle command that takes an argument: the same
// sheet a form is, with the command's own controls in it and its own verb on
// the button. Everything about it comes from the catalog — the title, the
// controls, the help under each — so a module that adds a command gets a
// screen without anybody writing one. The address says whether the command is
// about a row or about the list, and a command opened where it does not belong
// is refused rather than drawn.
import { Stack, useRouter } from "expo-router";
import { useFeedback } from "./useFeedback";
import React, { useCallback, useMemo } from "react";
import {
  commandOf,
  commandScope,
  commandTitle,
  humanize,
  otherScope,
  type Clock,
  type CommandScope,
} from "../core/derive";
import type { ScreenProps } from "../renderers";
import { Notice } from "../ui/atoms/Notice";
import { Button } from "../ui/atoms/Button";
import { ResourceForm as ResourceFormView } from "../ui/organisms/ResourceForm";
import { Screen } from "../ui/templates/Screen";
import { useCommandForm } from "./useCommand";
import { systemClock, useInitialDate } from "./clock";

export function ResourceCommand({
  entry,
  id,
  verb = "",
  clock = systemClock,
}: ScreenProps & { readonly clock?: Clock }) {
  const at = commandScope(id);
  const command = commandOf(entry, verb, at);
  if (!command) return <Refused entry={entry} verb={verb} at={at} />;
  return <Sheet entry={entry} id={id} command={command} clock={clock} />;
}

/**
 * Refused is a command that cannot run from where it was called. Two mistakes,
 * two sentences, because they send a person to different places: the verb may
 * not be one this entry offers at all, or it is one and belongs to the other
 * address — a command about one record opened where there is no row to send,
 * which would POST to an address the server mounts only for a command about the
 * whole list. The sheet is never offered for that, because a sheet you can fill
 * in is an invitation, and the only answer it could give is a refusal after the
 * typing.
 */
function Refused({
  entry,
  verb,
  at,
}: {
  readonly entry: ScreenProps["entry"];
  readonly verb: string;
  readonly at: CommandScope;
}) {
  const router = useRouter();
  // The way out is the one every sheet here uses: back over whatever pushed it,
  // which for a deep link is the screen the link was opened from.
  const done = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);
  const other = commandOf(entry, verb, otherScope(at));
  const text = other
    ? at === "collection"
      ? `${commandTitle(other)} acts on one ${entry.entity}, not the whole list. Open it from the ${entry.entity} it acts on.`
      : `${commandTitle(other)} acts on every ${entry.entity}, not one. Open it from the list of them.`
    : `${entry.entity} has no ${verb || "such"} command, or you may not run it.`;
  return (
    <Screen>
      <Notice
        announcement="urgent"
        text={text}
        testID="command-refused"
        action={{ label: "Close", onPress: done }}
      />
    </Screen>
  );
}

function Sheet({
  entry,
  id,
  command,
  clock,
}: {
  readonly entry: ScreenProps["entry"];
  readonly id: string | undefined;
  readonly command: NonNullable<ReturnType<typeof commandOf>>;
  readonly clock: Clock;
}) {
  const feedback = useFeedback();
  const initialDate = useInitialDate(clock);
  const form = useCommandForm(entry, id, command);
  const running = form.phase === "running";
  const { cancel, run, phase } = form;
  // The sheet is titled with the command's own summary and confirmed with its
  // verb: a header button is a word, not a sentence. The layout has already
  // put the verb up there, so the title only ever grows into itself.
  const title = commandTitle(command);
  const verb = humanize(command.verb);
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
        feedback={feedback}
        initialDate={initialDate}
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
