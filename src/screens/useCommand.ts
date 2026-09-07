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
import { commandControls, commandTitle, humanize, problems, values } from "../core/derive";
import { ApiError } from "../effects/api";
import { useShell } from "../shell";

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
  const router = useRouter();
  const navigation = useNavigation();
  // Memoised for the same reason useResourceForm memoises its own: run closes
  // over the controls, ResourceCommand memoises the header options over run,
  // and a fresh array on every render makes both of those memos a lie — which
  // is the shape of the navigator loop this app has already been bitten by.
  const controls = useMemo(() => commandControls(c), [c]);
  const [held, setHeld] = useState<Readonly<Record<string, string>>>({});
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [detail, setDetail] = useState("");
  const [phase, setPhase] = useState<Phase>("editing");
  // alive and left are useResourceForm's, for the same two reasons: a refusal
  // that arrives after the sheet is gone has nothing to set, and a sheet this
  // hook dismissed itself must not be dismissed twice.
  const alive = useRef(true);
  const left = useRef(false);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
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
    Alert.alert("Discard this?", `The ${commandTitle(c).toLowerCase()} has not run.`, [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          left.current = true;
          navigation.dispatch(data.action);
        },
      },
    ]);
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
      if (e instanceof ApiError) {
        setErrors(e.fields);
        setDetail(e.detail || `${commandTitle(c)} was refused.`);
        return;
      }
      setDetail(e instanceof Error ? e.message : `${commandTitle(c)} did not run.`);
    }
  }, [api, entry, id, c, controls, held, wrote, leave]);

  return { controls, held, errors, detail, phase, change, run, cancel: leave };
}

/**
 * useCommandAsk is a command with no argument: the confirmation, and what it
 * does when the answer is yes. The refusal is reported where it happened,
 * because there is no form on screen to put it under.
 */
export function useCommandAsk(entry: Entry, id: string | undefined) {
  const { api, wrote } = useShell();
  const [busy, setBusy] = useState("");

  const ask = useCallback(
    (c: Command) => {
      // The dialog is titled with the command's summary and answered with its
      // verb: the question is a sentence, the answer is a word.
      const title = commandTitle(c);
      Alert.alert(title, c.description || `This runs ${c.verb} on the ${entry.entity}.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: humanize(c.verb.replace(/-/g, " ")),
          onPress: async () => {
            setBusy(c.verb);
            try {
              await api.command(entry, id, c.verb);
              wrote(key(entry));
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
              const why = e instanceof ApiError ? e.detail : "";
              Alert.alert(title, why || (e instanceof Error ? e.message : "That did not run."));
            } finally {
              setBusy("");
            }
          },
        },
      ]);
    },
    [api, entry, id, wrote],
  );

  return { ask, busy };
}
