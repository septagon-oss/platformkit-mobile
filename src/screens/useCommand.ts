// useCommand runs one of an entry's lifecycle commands.
//
// A command that takes no argument is a question, not a form: the platform's own
// dialog asks it, titled with the command's label and answered with that same
// word. A command that takes an argument is a sheet, and this hook is what that
// sheet saves through.
//
// What a person is told about a command — its title, its answer, the record it
// runs on, what running it does and what the record says afterwards — is
// `commandWording`'s answer, read once here and drawn by whichever surface shows
// it. The developer's `description` of the wire member is never among them, and
// neither is a sentence invented about a consequence nobody declared.
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
import { address } from "../core/reentry";
import {
  changedFields,
  commandOf,
  commandPath,
  commandSections,
  commandTitle,
  commandWording,
  failureSubject,
  label,
  offered,
  problems,
  screenPath,
  values,
  type CommandWording,
  type Row,
} from "../core/derive";
import { keyed } from "../effects/api";
import { refusalFields, refusalOf, screenCopy } from "./failure";
import { useShell } from "../shell";
import { confirm } from "../ui/chooser";
import { useTheme } from "../ui/theme";

export type Phase = "editing" | "running" | "ran";

export interface Running {
  readonly blocks: ReturnType<typeof commandSections>;
  readonly held: Readonly<Record<string, string>>;
  readonly errors: Readonly<Record<string, string>>;
  readonly detail: string;
  /** A control that will not store what it holds says so here; see `useResourceForm`. */
  readonly fieldRefused: (name: string, refused: boolean) => void;
  readonly phase: Phase;
  /** wording is what this sheet says about the command: its title, its answer, the record it acts on, what running it does and what the record says afterwards. */
  readonly wording: CommandWording;
  readonly change: (name: string, value: string) => void;
  readonly run: () => Promise<void>;
  readonly cancel: () => void;
}

/**
 * useRecordTitle is the words the record a command acts on answers with, read for
 * the sheet that has to name them. A row this person may not read costs the line
 * and not the action: the answer stays "" and the sheet, its controls and its run
 * button are exactly what they were, because whether the verb belongs to them is
 * the server's answer to the run, not this read's.
 */
export function useRecordTitle(entry: Entry, id: string | undefined): string {
  const { api } = useShell();
  // The answer is held with the id it was read for, so a sheet shown for another
  // record says nothing until its own read answers — no reset to write, and no
  // title outliving the record it belongs to.
  const [read, setRead] = useState<{ on?: string; title: string }>({ title: "" });
  useEffect(() => {
    let alive = true;
    if (!id) return () => void (alive = false);
    void (async () => {
      try {
        const row: Row = await api.get(entry, id);
        // The record is named by the one chain that names it everywhere else, and
        // an untitled row says nothing here rather than quoting an identifier.
        if (alive) setRead({ on: id, title: label(entry, row, () => "", "record") });
      } catch {
        // Silence: the line is not drawn, and the command is still offered.
      }
    })();
    return () => void (alive = false);
  }, [api, entry, id]);
  return read.on === id ? read.title : "";
}

/** useCommandForm is a command with an argument: the sheet that sends it. */
export function useCommandForm(entry: Entry, id: string | undefined, c: Command): Running {
  const { api, wrote, say, celebrate, outbox } = useShell();
  const { mode } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const actsOn = useRecordTitle(entry, id);
  // Memoised for the same reason useResourceForm memoises its own: run closes
  // over the argument's controls, ResourceCommand memoises the header options over run,
  // and a fresh array on every render makes both of those memos a lie — which
  // is the shape of the navigator loop this app has already been bitten by.
  const blocks = useMemo(() => commandSections(c), [c]);
  const controls = useMemo(() => blocks.flatMap((b) => b.controls), [blocks]);
  const copy = screenCopy();
  const wording = commandWording(c, actsOn, copy);
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
  // Changed, not touched — the one predicate every protected form in this app asks,
  // so an argument typed and put back is never worth a question.
  const dirty = changedFields(controls, held).length > 0;

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
        label: copy.kit.discard,
        destructive: true,
        onPress: () => {
          left.current = true;
          navigation.dispatch(data.action);
        },
      },
      mode,
      {
        message: `The ${commandTitle(c).toLowerCase()} has not run.`,
        cancel: copy.kit.keepEditing,
      },
    );
  });

  // A box that will not store what it holds says so here, and the run below meets
  // the same answer as a `problems` refusal. See `useResourceForm` for the rule.
  const refusing = useRef<Readonly<Record<string, boolean>>>({});
  const fieldRefused = useCallback((name: string, refused: boolean) => {
    if ((refusing.current[name] ?? false) === refused) return;
    const next = { ...refusing.current };
    if (refused) next[name] = true;
    else delete next[name];
    refusing.current = next;
  }, []);

  const run = useCallback(async () => {
    const wrong = problems(controls, held, copy.kit);
    if (Object.keys(wrong).length > 0 || Object.keys(refusing.current).length > 0) {
      setErrors(wrong);
      return;
    }
    setPhase("running");
    try {
      const body = values(controls, held);
      const live = (idem?: string) => api.command(entry, id, c.verb, body, ...keyed(idem));
      // A command is the write most worth holding: it is the one the person
      // cannot repeat by retyping a field, and the server that never heard it
      // never ran it. A command this phone is holding has not run, and says so.
      const answer = outbox
        ? await outbox.submit(
            {
              kind: "command",
              resourceKey: key(entry),
              path: commandPath(entry, c.verb, id),
              body,
            },
            live,
          )
        : { sent: true as const, row: await live() };
      if (!alive.current) return;
      if (!answer.sent) {
        setDetail(copy.state.holding(copy.state.held.title));
        setPhase("editing");
        return;
      }
      // This sheet is on its way out, so the sentence that says the command ran
      // is filed for the record it ran on, which reads it once on arrival — the
      // channel a save already uses, and the only one. A command about the whole
      // list has no record to land on and files nothing, and a command the phone
      // is holding has not run.
      if (id) say(address("detail", entry, id), wording.success);
      // Whether that change ended the record is not this sheet's to know and not its to guess:
      // the filing below says only that this phone wrote here, and the record holding the row
      // decides whether the state it holds is one its entry calls finished.
      if (id) celebrate(address("detail", entry, id));
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
      setDetail(said.text);
    }
  }, [api, entry, id, c, controls, held, wrote, say, celebrate, leave, copy, wording, outbox]);

  return { blocks, held, errors, detail, phase, wording, change, fieldRefused, run, cancel: leave };
}

/**
 * useCommandSend is one command's submit, shared by every door that runs one: the hold, the
 * idempotency key, the write count, the felt tick and the filing.
 *
 * The caller is handed the success sentence rather than printing it, because only the caller
 * knows who is left standing to say it: the record a sheet dismissed files it for the address the
 * person lands on, a row that stayed on the screen says it there. A command this phone is holding
 * has not run, so nothing is filed and the hold's own sentence is shown where it was asked. A
 * refusal is a report and not a question — the platform's alert with its one answer, because
 * there is no form on screen to put it under.
 */
function useCommandSend(entry: Entry) {
  const { api, wrote, celebrate, outbox } = useShell();
  return useCallback(
    async (c: Command, id: string | undefined, told: (success: string) => void) => {
      const { title, success } = commandWording(c, "", screenCopy());
      try {
        // A command that takes no argument sends no argument at all, key or
        // no key: the key rides after the argument slot it does not use.
        const live = (idem?: string) =>
          idem === undefined
            ? api.command(entry, id, c.verb)
            : api.command(entry, id, c.verb, undefined, { idempotencyKey: idem });
        // A command is the write most worth holding: it is the one the person
        // cannot repeat by retyping a field, and the server that never heard it
        // never ran it.
        const answer = outbox
          ? await outbox.submit(
              {
                kind: "command",
                resourceKey: key(entry),
                path: commandPath(entry, c.verb, id),
              },
              live,
            )
          : { sent: true as const, row: await live() };
        if (answer.sent) {
          // The record the command ran on is what says what it did — unless the
          // thing that ran it never left the screen, which is the caller's
          // decision and the only reason this line is a callback. A command
          // about the whole list has no record to land on, and one the phone is
          // holding has not run.
          told(success);
          // The record decides what this write did to its own state; this one files only
          // the fact that the person, standing here, asked for it.
          if (id) celebrate(address("detail", entry, id));
          wrote(key(entry));
        } else {
          const words = screenCopy();
          Alert.alert(title, words.state.holding(words.state.held.title));
        }
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
      }
    },
    [api, entry, wrote, celebrate, outbox],
  );
}

/**
 * useCommandAsk is a command with no argument: the confirmation, and what it
 * does when the answer is yes. The refusal is reported where it happened,
 * because there is no form on screen to put it under.
 */
export function useCommandAsk(entry: Entry, id: string | undefined) {
  const { say } = useShell();
  const { mode } = useTheme();
  const send = useCommandSend(entry);
  const [busy, setBusy] = useState("");

  const ask = useCallback(
    (c: Command) => {
      // The dialog is titled with the command's own word and answered with that
      // same word; what it says under the title is what running it does. The
      // record the command acts on is the screen the dialog is drawn over, so it
      // is not repeated inside the question, and a command about the whole list
      // has no record to name.
      const { title, button, consequence } = commandWording(c, "", screenCopy());
      confirm(
        title,
        {
          label: button,
          onPress: async () => {
            setBusy(c.verb);
            await send(c, id, (success) => {
              if (id) say(address("detail", entry, id), success);
            });
            setBusy("");
          },
        },
        mode,
        { message: consequence },
      );
    },
    [entry, id, say, send, mode],
  );

  return { ask, busy };
}

/**
 * useRowCommand is a list's commands: the same submit as a record's, with the record named when the
 * person chooses rather than when the screen mounts — a list holds many rows and a hook is made for
 * the screen, not for each row.
 *
 * Which command a row runs is the entry's declaration and nothing else, resolved by the same lookup
 * a routed sheet uses, so a swipe and a typed deep link cannot disagree about what a verb names. A
 * release at the end of a drag is an answer already given, so it runs straight through except where
 * the document says the act hurts, or says what it does: a revealed surface carries one word and no
 * sentence under it, so those two are asked first. One run per record and verb at a time; two rows
 * are two records, and neither one is "the command is running".
 */
export function useRowCommand(entry: Entry) {
  const { mode } = useTheme();
  const { report } = useShell();
  const send = useCommandSend(entry);
  // Which `${id}/${verb}` pairs are under way. A ref, not state: nothing draws it, and a row
  // released twice while its write is out must have been released once.
  const running = useRef<Set<string>>(new Set());

  const run = useCallback(
    (id: string) => {
      const verb = entry.hints?.primaryCommand;
      const c = verb === undefined ? undefined : commandOf(entry, verb, "record");
      if (c === undefined || !offered(c)) return;
      const at = `${id}/${c.verb}`;
      if (running.current.has(at)) return;
      const start = () => {
        if (running.current.has(at)) return;
        running.current.add(at);
        void send(c, id, report).finally(() => {
          running.current.delete(at);
        });
      };
      const { title, button, consequence } = commandWording(c, "", screenCopy());
      // Either declaration opens the question: that the act hurts, or that its author said what
      // it does. They are independent facts on the wire and neither is guessed here.
      if (c.hints?.destructive === true || consequence !== "") {
        confirm(
          title,
          { label: button, destructive: c.hints?.destructive === true, onPress: start },
          mode,
          { message: consequence },
        );
        return;
      }
      start();
    },
    [entry, report, send, mode],
  );

  return { run };
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
