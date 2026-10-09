// useCommand runs one of an entry's lifecycle commands.
//
// A command that takes no argument is a question, not a form: the platform's
// own dialog asks it, with the command's own description as the sentence,
// because that description is the one in the API document and nobody should
// write a second one here. A command that takes an argument is a sheet, and
// this hook is what that sheet saves through.
//
// Either way the write counter is bumped, so the detail beneath and its
// activity re-read themselves: a command is exactly the kind of change that
// happens to a record without the form that is open having done it.
import * as Haptics from "expo-haptics";
import { useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { key, type Command, type Entry } from "../core/catalog";
import {
  commandControls,
  commandTitle,
  failureSubject,
  humanize,
  problems,
  screenPath,
  values,
} from "../core/derive";
import { refusalFields, refusalOf, screenCopy } from "./failure";
import { useShell } from "../shell";
import { confirm } from "../ui/chooser";
import { useTheme } from "../ui/theme";

export type Phase = "editing" | "running" | "ran";

export interface Running {
  readonly controls: ReturnType<typeof commandControls>;
  readonly held: Readonly<Record<string, string>>;
  readonly errors: Readonly<Record<string, string>>;
  readonly detail: string;
  readonly phase: Phase;
  readonly change: (name: string, value: string) => void;
  readonly run: () => Promise<void>;
  readonly cancel: () => void;
}

/** useCommandForm is a command with an argument: the sheet that sends it. */
export function useCommandForm(entry: Entry, id: string | undefined, c: Command): Running {
  const { api, wrote } = useShell();
  const { mode } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  // Memoised for the same reason useResourceForm memoises its own: run closes
  // over the controls, ResourceCommand memoises the header options over run,
  // and a fresh array on every render makes both of those memos a lie — which
  // is the shape of the navigator loop this app has already been bitten by.
  const controls = useMemo(() => commandControls(c), [c]);
  const copy = screenCopy();
  const [held, setHeld] = useState<Readonly<Record<string, string>>>({});
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [detail, setDetail] = useState("");
  const [phase, setPhase] = useState<Phase>("editing");
  // alive and left are useResourceForm's, for the same two reasons: a refusal
  // that arrives after the sheet is gone has nothing to set, and a sheet this
  // hook dismissed itself must not be dismissed twice.
  const alive = useRef(true);
  const left = useRef(false);
  useEffect(() => {
    // Set on the way in as well as cleared on the way out. A ref initialised
    // once is initialised once per hook instance, not once per mount, and a
    // remount — Fast Refresh, a strict double-invoke — runs the cleanup
    // without running the initialiser again. Leaving it false makes every
    // later await return silently: the form sat disabled with its spinner on
    // and nothing to say, which is what the device showed.
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const dirty = Object.keys(held).length > 0;

  const change = useCallback((name: string, value: string) => {
    setHeld((was) => ({ ...was, [name]: value }));
  }, []);

  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    if (router.canGoBack()) router.back();
  }, [router]);

  // An argument somebody typed is not thrown away by a swipe. The guard is off
  // while the command runs, because the dismissal is then this hook's own.
  usePreventRemove(phase === "editing" && dirty, ({ data }) => {
    confirm(
      "Discard this?",
      {
        label: "Discard",
        destructive: true,
        onPress: () => {
          left.current = true;
          navigation.dispatch(data.action);
        },
      },
      mode,
      { message: `The ${commandTitle(c).toLowerCase()} has not run.`, cancel: "Keep editing" },
    );
  });

  const run = useCallback(async () => {
    const wrong = problems(controls, held);
    if (Object.keys(wrong).length > 0) {
      setErrors(wrong);
      return;
    }
    setPhase("running");
    try {
      await api.command(entry, id, c.verb, values(controls, held));
      if (!alive.current) return;
      wrote(key(entry));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase("ran");
      leave();
    } catch (e) {
      if (!alive.current) return;
      setPhase("editing");
      const said = refusalOf(e, "command", failureSubject(entry, commandTitle(c)), copy);
      if (said.verdict.outcome === "silent") return;
      setErrors(refusalFields(said.verdict));
      setDetail(said.text || copy.kit.validation);
    }
  }, [api, entry, id, c, controls, held, wrote, leave, copy]);

  return { controls, held, errors, detail, phase, change, run, cancel: leave };
}

/**
 * useCommandAsk is a command with no argument: the confirmation, and what it
 * does when the answer is yes. The refusal is reported where it happened,
 * because there is no form on screen to put it under.
 */
export function useCommandAsk(entry: Entry, id: string | undefined) {
  const { api, wrote } = useShell();
  const { mode } = useTheme();
  const [busy, setBusy] = useState("");

  const ask = useCallback(
    (c: Command) => {
      // The dialog is titled with the command's summary and answered with its
      // verb: the question is a sentence, the answer is a word.
      const title = commandTitle(c);
      confirm(
        title,
        {
          label: humanize(c.verb),
          onPress: async () => {
            setBusy(c.verb);
            try {
              await api.command(entry, id, c.verb);
              wrote(key(entry));
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
              // A report, not a question: the platform's alert with its one OK,
              // because there is no form on screen to put the refusal under.
              // The report is the classified sentence, so an unanswered command
              // says nothing is known rather than claiming the command failed.
              Alert.alert(
                title,
                refusalOf(e, "command", failureSubject(entry, title), screenCopy()).text ||
                  screenCopy().failure.commandFailed(title),
              );
            } finally {
              setBusy("");
            }
          },
        },
        mode,
        { message: c.description || `This runs ${c.verb} on the ${entry.entity}.` },
      );
    },
    [api, entry, id, wrote, mode],
  );

  return { ask, busy };
}

/**
 * useCommandRun is what a record screen does with the commands its entry names:
 * one with no argument is asked here, one with an argument opens its own sheet.
 * That difference is one rule — where the command is going decides which door it
 * is behind — so it has one owner, and the generated detail and a renderer pack
 * both call this rather than each spelling the address out again.
 */
export function useCommandRun(entry: Entry, id: string | undefined) {
  const { ask, busy } = useCommandAsk(entry, id);
  const router = useRouter();
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
  return { run, busy };
}
