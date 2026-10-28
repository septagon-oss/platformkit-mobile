// useResourceForm is the sheet's imperative shell. Its phase is explicit:
// loading the row to edit, failed to, editing, saving, saved. Save exists only
// while editing, so a form that never loaded cannot save an empty row over
// one; a dirty sheet asks before it is dismissed, by gesture as well as by
// button; a sheet that is saving cannot be dismissed at all; and a sheet that
// has saved leaves without asking.
import * as Haptics from "expo-haptics";
import { useNavigation, useRouter } from "expo-router";
// The navigation hook that a native stack honours moved inside the router's
// own re-export of react-navigation in SDK 57.
import { usePreventRemove } from "expo-router/react-navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { key, offers, type Entry } from "../core/catalog";
import { address } from "../core/reentry";
import { useRecordNames } from "./useReferenceNames";
import {
  type Problem,
  type Step,
  type StepperInput,
  type StepEvent,
  changedFields,
  controlPointers,
  firstProblem,
  formControls,
  formSections,
  problems,
  saveBody,
  stepBlocks,
  stepOwning,
  stepProblems,
  steppedForm,
  stepTransition,
  stepVerb,
  walkSteps,
  writeLanguage,
  writePath,
} from "../core/form";
import { failureSubject, verbRefusal } from "../core/command";
import { noun, text } from "../core/present";
import { screenPath, type Row } from "../core/record";
import { keyed, langQuery } from "../effects/api";
import { useShell } from "../shell";
import { confirm } from "../ui/chooser";
import type { Phase } from "../ui/organisms/ResourceForm";
import { useTheme } from "../ui/theme";
import { refusalFields, refusalOf, screenCopy, screenLanguage } from "./failure";

export function useResourceForm(entry: Entry, id: string | undefined) {
  const { api, wrote, typed, keep, say, celebrate, outbox } = useShell();
  const { mode } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const create = !id;
  const copy = screenCopy();
  // This sheet's own address, which is what the shell files what is typed under.
  const here = address("form", entry, id);
  const [row, setRow] = useState<Row | undefined>();
  // The language this row was served in, kept beside it rather than inside it: the row stays
  // the server's own document, and Save needs the tag to say which language its words are
  // written in. "" is a read that named no language, which is the record's own copy.
  const [servedIn, setServedIn] = useState("");
  const [phase, setPhase] = useState<Phase>(create ? "editing" : "loading");
  // A sheet that mounts while the server is refusing the session that would have
  // saved it starts from what was typed there, rather than from nothing.
  const [held, setHeld] = useState<Readonly<Record<string, string>>>(() => typed(here) ?? {});
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [detail, setDetail] = useState("");
  // The field the sheet is waiting on: the first one it asks for that carries a
  // sentence. The organism brings it forward; typing into it is what clears it.
  const [awaiting, setAwaiting] = useState("");
  // How many times this sheet has refused. A second Save on a sheet nobody mended asks
  // for the same field, so `awaiting` alone says nothing new and the organism's effect
  // would not run again; the count is what makes the second refusal a new request for
  // the box. Every refusal counts itself, named or not.
  const [refusals, setRefusals] = useState(0);
  // A person's own answer of "Discard" - or a Cancel over a sheet with nothing to
  // discard. Leaving is an instruction to the effect below rather than a call to the
  // router: the guard has to lift in a render before the screen departs, or the stack
  // hands this departure back to the guard and asks the same question twice.
  const [leaving, setLeaving] = useState(false);
  const [saved, setSaved] = useState<Row | undefined>();
  const generation = useRef(0);
  // Leaving happens once. The effect below depends on the router, whose
  // identity is not guaranteed to be stable, and a second replace would pop a
  // screen that is already gone: on Android that unwinds the stack until the
  // app itself exits.
  const left = useRef(false);
  // A save outlives its screen when somebody dismisses the sheet while the
  // request is in flight. The write still lands and the list still hears about
  // it; what must not happen is this screen deciding where to go afterwards.
  const alive = useRef(true);
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

  const load = useCallback(async () => {
    if (!id) return;
    const started = ++generation.current;
    try {
      const got = await api.served(entry, id);
      if (generation.current !== started) return;
      setRow(got.row);
      setServedIn(got.language);
      setPhase("editing");
    } catch (e) {
      if (generation.current !== started) return;
      const said = refusalOf(e, "read", failureSubject(entry), copy);
      if (said.verdict.outcome === "silent") return;
      setDetail(said.text);
      setPhase("failed");
    }
  }, [api, entry, id]);

  useEffect(() => {
    // The await is spelled out here rather than hidden behind a call, so it is
    // plain that nothing is set during the render this effect runs after.
    void (async () => {
      await load();
    })();
  }, [load]);

  // The sheet's blocks are the entry's sections; the controls are those blocks
  // read back flat, which is what a body and a refusal are built from. One order,
  // computed once, so the order a person is asked in cannot drift from the order
  // the sheet writes.
  // The records the greyed boxes point at are read once for the sheet, so the
  // person reads a name where the row holds an identifier and the write still
  // sends what it was given (`Control.echo`).
  const asked = useMemo(
    () => controlPointers(formControls(entry, row, create), row),
    [entry, row, create],
  );
  const names = useRecordNames(asked);
  const blocks = useMemo(
    () => formSections(entry, row, create, copy.kit.overview, names),
    [entry, row, create, copy.kit.overview, names],
  );
  const controls = useMemo(() => blocks.flatMap((b) => b.controls), [blocks]);
  /* The walk is the server's. `steppedForm` answers the resolved step list for this
   * mode or nothing, `stepBlocks` gives each step the controls that name one of its
   * fields, and everything below the two — a body, a write, a refusal — keeps being
   * built from `controls`, the whole sheet read flat. A step the sheet would draw
   * empty is no step, so `walk` shorter than `steps` is the entry's own answer, and
   * `walk` empty means this sheet is not walked at all: the person gets the one
   * scroll the entry asks for and every line below stays unread. */
  const steps = useMemo(() => steppedForm(entry, create) ?? [], [entry, create]);
  const walk = useMemo(() => stepBlocks(steps, controls), [steps, controls]);
  const stepped = walk.length > 0;
  // Where the person stands, and which steps they have crossed: the sheet's whole step
  // state. A row that arrives after they reached step two keeps them on step two, and a
  // step no longer named by the block this row yields leaves the walk with it.
  const [standing, setStanding] = useState("");
  const [crossed, setCrossed] = useState<Readonly<Record<string, Step["completion"]>>>({});
  const at = stepped && walk.some((b) => b.key === standing) ? standing : (walk[0]?.key ?? "");
  // The sentences a step wears are the ones the sheet already announced — its own refused
  // fields, in the step's order. A live "required" while a box is still being typed in is
  // not a refusal, and `next` is where the sheet decides one.
  const marks = useMemo(() => {
    const out: Record<string, readonly Problem[]> = {};
    for (const block of walk) {
      const asked = steps.find((s) => s.key === block.key)?.fields ?? [];
      const named = asked.filter((name) => errors[name] !== undefined);
      if (named.length > 0)
        out[block.key] = named.map((name) => ({ fieldId: name, message: errors[name]! }));
    }
    return out;
  }, [walk, steps, errors]);
  const stages = useMemo(
    () =>
      walkSteps(walk, steps, held, errors).map((stage) => ({
        ...stage,
        completion: crossed[stage.id] ?? "incomplete",
        problems: marks[stage.id] ?? [],
      })),
    [walk, steps, held, errors, crossed, marks],
  );
  // Dirty means changed, not touched: a person who typed something and put it back
  // changed nothing, and asking them whether to throw it away wastes the question.
  const dirty = changedFields(controls, held).length > 0;
  // The same contents, held for the callbacks that must not change identity: the
  // sheet puts Save and Cancel in the navigator's options, and an option rebuilt
  // on every render is an instruction the navigator repeats forever.
  const contents = useRef<Readonly<Record<string, string>>>(held);

  /* One field can refuse what it holds without the core being able to see it: a
   * comma-joined box keeps a word it cannot store out of the value, and the text
   * stays on screen. `refusing` is the set of those fields, and a save meets the
   * same answer as a `problems` refusal — nothing leaves the phone while a field the
   * person is being asked to fix still stands. */
  const refusing = useRef<Readonly<Record<string, boolean>>>({});
  const fieldRefused = useCallback((name: string, refused: boolean) => {
    if ((refusing.current[name] ?? false) === refused) return;
    const next = { ...refusing.current };
    if (refused) next[name] = true;
    else delete next[name];
    refusing.current = next;
  }, []);

  /* The walk itself. One transition owns every move, forward, back, skipped or
   * jumped to, so the order a person may take through a form is decided in one
   * place — the core's — and this sheet only says which move happened and adopts
   * where it landed. `crossed` and `standing` are all it keeps: the stepper's own
   * stages are re-derived from the answers each render, so a step whose fields
   * changed is incomplete again without a rule written twice. */
  // The sheet as the stepper states it: its stages, where the person stands, the tense
  // the sheet is in, and the last step's own verb as the write's door. One spelling of
  // it, so the model a screen draws and the transition a move is checked against cannot
  // answer for two sheets.
  const stepperWords = useCallback(
    (busy: "editing" | "validating" | "submitting" | "finished" = "editing"): StepperInput => {
      const last = stages[stages.length - 1];
      return {
        steps: stages,
        ...(at === "" ? {} : { currentId: at }),
        phase:
          busy === "editing" && phase === "failed"
            ? "failed"
            : busy === "editing"
              ? "editing"
              : busy,
        finish: {
          id: "save",
          label: last?.primary ?? copy.kit.finish,
          tone: "primary",
          state: "ready",
        },
        dirty,
      };
    },
    [stages, at, phase, copy.kit.finish, dirty],
  );
  const walkTo = useCallback(
    (event: StepEvent, busy: "editing" | "validating" = "editing") => {
      const moved = stepTransition(stepperWords(busy), event);
      if (!moved.ok) return false;
      setCrossed(
        Object.fromEntries(moved.value.steps.map((s) => [s.id, s.completion])) as Record<
          string,
          Step["completion"]
        >,
      );
      setStanding(moved.value.currentId ?? "");
      return true;
    },
    [stepperWords],
  );
  // The step a person stands on, or nothing when the walk left the block this row yields.
  const stepAt = (key: string) => steps.find((s) => s.key === key);
  // Next answers this step alone: the fields it asked, held as they stand, through the
  // same `problems` the write is answered by. Nothing leaves the phone on a step move and
  // nothing is written — a person who is refused stays where they were with the sentence
  // on the box that owes it, which is the sheet's ordinary colouring, not a new one.
  const next = useCallback(() => {
    const asked = stepAt(at);
    if (asked === undefined || phase !== "editing") return;
    const owed = stepProblems(asked, controls, contents.current, copy.kit);
    const held = (asked.fields ?? []).filter((name) => refusing.current[name] === true);
    if (owed.length > 0 || held.length > 0) {
      if (owed.length > 0)
        setErrors({
          ...errors,
          ...Object.fromEntries(owed.map((p) => [p.fieldId, p.message])),
        });
      setDetail(copy.kit.validation);
      setAwaiting(owed[0]?.fieldId ?? held[0] ?? "");
      setRefusals((n) => n + 1);
      return;
    }
    walkTo({ kind: "validated", problems: [] }, "validating");
  }, [at, steps, phase, controls, copy.kit, errors, walkTo]);
  const back = useCallback(() => {
    walkTo({ kind: "back" });
  }, [walkTo]);
  const go = useCallback(
    (id: string) => {
      walkTo({ kind: "go", stepId: id });
    },
    [walkTo],
  );
  const skip = useCallback(() => {
    walkTo({ kind: "skip" });
  }, [walkTo]);
  // A refusal — the phone's or the server's — returns the person to the step that asked the
  // first field it named, and marks that step needing an answer again. A sentence naming no
  // step of this walk leaves them where they stand: it is read over the sheet, not walked to.
  const answerTo = useCallback(
    (refused: Readonly<Record<string, string>>) => {
      if (!stepped) return;
      const owner = stepOwning(steps, refused);
      if (owner === undefined) return;
      setStanding(owner);
      setCrossed((own) => ({ ...own, [owner]: "incomplete" }));
    },
    [stepped, steps],
  );

  // What the sheet asks before it throws away what a person wrote, in the words the
  // copy table holds in both languages. One function, asked by the guard the platform
  // honours and by the header's Cancel alike, so neither can dismiss a dirty sheet
  // alone and the two answers are the same two continuations.
  const askDiscard = useCallback(
    (discard: () => void) => {
      confirm(
        copy.kit.discardChanges,
        {
          label: copy.kit.discard,
          destructive: true,
          onPress: discard,
        },
        mode,
        { message: copy.kit.discardUnsaved, cancel: copy.kit.keepEditing },
      );
    },
    [copy, mode],
  );

  // usePreventRemove is what a native stack honours: it covers the swipe and
  // the system back as well as the header's Cancel. It guards the editing
  // phase only. While a save is in flight and after it lands, the screen is
  // dismissed by this app rather than by a person, and a guard that is still
  // registered then leaves the native screen refusing the dismissal it was
  // just asked for.
  // `leaving` lifts the guard one render before the sheet departs by Cancel: a
  // departure taken while this is armed is handed back to it by the stack, and the
  // person answers the same question twice. The gesture and the system back need no
  // such flag - the action this callback re-dispatches already carries the route as
  // visited, which is why that door asks once.
  // The one guard, three answers, and the position in the walk decides which: a step
  // back is not a departure and asks nothing, leaving a dirty sheet from its first step
  // asks once, and leaving a clean one is not a question at all. A flat sheet has no
  // position, so it gets the second and third answers exactly as it always did.
  const first = !stepped || at === walk[0]?.key;
  usePreventRemove(phase === "editing" && !leaving && (!first || dirty), ({ data }) => {
    if (!first) {
      back();
      return;
    }
    askDiscard(() => {
      // Discarded means the shell keeps none of it either.
      keep(here, {});
      navigation.dispatch(data.action);
    });
  });

  // Leaving happens after the render that cleared the guard above.
  useEffect(() => {
    if (phase !== "saved" || left.current) return;
    left.current = true;
    // The row is on the server now: this sheet holds nothing anybody still needs.
    keep(here, {});
    const at = screenPath(entry);
    // A sheet opened from a link has nothing to go back to; the record it just
    // wrote is where it belongs.
    if (create && saved) router.replace(`${at}/${encodeURIComponent(text(saved.id))}`);
    else if (router.canGoBack()) router.back();
    else if (id) router.replace(`${at}/${encodeURIComponent(id)}`);
    else router.replace(at);
  }, [phase, saved, create, entry, id, router, here, keep]);

  // Cancel's "Discard" leaves here, one render after the flag above lifted the guard,
  // and not from the dialog's own button. One screen leaves once, which is why this
  // shares `left` with the departure above instead of keeping a flag of its own.
  useEffect(() => {
    if (!leaving || left.current) return;
    left.current = true;
    // Discarded means the shell keeps none of it either.
    keep(here, {});
    // Back to whatever opened the sheet; a sheet opened by a link has nothing to go
    // back to, so it lands on the list of what it did not write.
    if (router.canGoBack()) router.back();
    else router.replace(screenPath(entry));
  }, [leaving, entry, here, keep, router]);

  // Every callback this hook hands out is stable, because the screen puts them
  // in the options it gives the navigator, and options rebuilt on each render
  // are an instruction repeated forever.
  const change = useCallback(
    (name: string, value: string) => {
      contents.current = { ...contents.current, [name]: value };
      setHeld(contents.current);
      setErrors(({ [name]: _, ...rest }) => rest);
      // The field the sheet was waiting on is the one the person is mending.
      if (name === awaiting) setAwaiting("");
      keep(here, contents.current);
    },
    [here, keep, awaiting],
  );

  const save = useCallback(async () => {
    if (phase !== "editing") return;
    // The header's New/Edit button is the door for this write, and it is drawn
    // from doors(entry). A sheet can also be reached by a link or a restored
    // stack, so the verb half of that rule is checked again here: a create the
    // resource does not mount has no address to POST to, and nothing is sent to
    // find out.
    if (!offers(entry, create ? "create" : "update")) {
      setDetail(verbRefusal(create ? "create" : "update", copy));
      return;
    }
    const refused = problems(controls, held, copy.kit);
    if (Object.keys(refused).length > 0 || Object.keys(refusing.current).length > 0) {
      setErrors(refused);
      // The kit's own word for it: the sentence is the one the copy table holds.
      setDetail(copy.kit.validation);
      setAwaiting(firstProblem(controls, refused) ?? "");
      setRefusals((n) => n + 1);
      answerTo(refused);
      return;
    }
    setPhase("saving");
    setDetail("");
    setAwaiting("");
    try {
      // The read said which language the words this sheet shows arrived in; the write says
      // the same thing back. A body of somebody's Portuguese sent without its language would
      // be filed as the record's own copy, over the source that translation was made from,
      // and no later read of the record would show that it had happened.
      const speaking = screenLanguage();
      const writing = writeLanguage(row, controls, held, speaking, servedIn);
      if (writing !== undefined && writing.other.length > 0) {
        // A translation and the record's own fields are two writes at two addresses; half of
        // one is not a thing this sheet sends.
        setDetail(copy.kit.mixedLanguageWrite);
        setAwaiting(writing.other[0]!);
        setRefusals((n) => n + 1);
        setPhase("editing");
        return;
      }
      // What the write carries follows from where it goes: a language write holds the fields
      // that language owns, and the record's own copy holds none of the translations this
      // person left alone.
      const body = saveBody(controls, held, row, writing, speaking, servedIn);
      // `idem` is the write's idempotency key, minted by the queue before the
      // first attempt and named on the request: the attempt that may have landed
      // and the replay that follows a hold are then one write to a server that
      // honours the header.
      const live = (idem?: string) => {
        const options = keyed(idem, writing?.locale ?? "");
        return id ? api.update(entry, id, body, ...options) : api.create(entry, body, ...options);
      };
      // One write, one decision: it went, or this phone is holding it. A held
      // write is not saved, so nothing here says it was — the sheet closes and
      // the held row says what it is, in the server's own words when it refuses.
      const answer = outbox
        ? await outbox.submit(
            {
              kind: id ? "update" : "create",
              resourceKey: key(entry),
              // The language travels with the address rather than the body: a held write
              // replays by the address it was filed under, and a replay that landed in the
              // wrong language is the write this sheet was told not to make.
              path: id
                ? `${writePath(entry)}/${encodeURIComponent(id)}${langQuery(
                    writing === undefined ? undefined : { lang: writing.locale },
                  )}`
                : writePath(entry),
              body,
            },
            live,
          )
        : { sent: true as const, row: await live() };
      if (!alive.current) return;
      if (!answer.sent) {
        // The body is on this phone and the row on Home names it, so the draft has
        // nothing left to hold: a second copy of the same words saved by hand would
        // be a second write.
        setPhase("saved");
        return;
      }
      const written = answer.row;
      wrote(key(entry));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // The sheet is about to leave, so the sentence that says the write landed
      // cannot live in it: it is filed for the address the person lands on, where
      // that record's own screen reads it once. A create lands on the row the
      // server just made, an edit back on the one this sheet was called by.
      say(
        create
          ? `${screenPath(entry)}/${encodeURIComponent(text(written.id))}`
          : address("detail", entry, id),
        create ? copy.kit.created(noun(entry).singular) : copy.kit.changesSaved,
      );
      // An edit is filed for the record it edited. A create is not filed at all: a first state
      // crossed nothing — there was no earlier value to cross from — so a new record is never the
      // one a phone surprises a person with.
      if (!create && id) celebrate(address("detail", entry, id));
      setSaved(written);
      setPhase("saved");
    } catch (e) {
      if (!alive.current) return;
      const said = refusalOf(e, create ? "create" : "update", failureSubject(entry), copy);
      if (said.verdict.outcome === "silent") return;
      // A 422 that named fields colours those fields and adds no sentence; an
      // unanswered save says what is honest — that nothing is known. The values the
      // person typed stay exactly where they are: no failure path touches `held`.
      const fields = refusalFields(said.verdict);
      setErrors(fields);
      setDetail(said.text);
      setAwaiting(firstProblem(controls, fields) ?? "");
      setRefusals((n) => n + 1);
      setPhase("editing");
      // The answers stay where they are and the walk goes back to the step that was
      // asked for them: a 422 about the first step read from the third is a person
      // scrolling to hunt for it otherwise.
      answerTo(fields);
    }
  }, [
    phase,
    controls,
    held,
    row,
    servedIn,
    id,
    api,
    entry,
    wrote,
    copy,
    create,
    say,
    celebrate,
    outbox,
    answerTo,
  ]);

  // Cancel is the third door out of a dirty sheet, and it asks the same question the
  // gesture and the system back are asked: an answer of "Keep editing" leaves the
  // person where they were with the draft and the guard both intact.
  const cancel = useCallback(() => {
    // Both answers leave through the flag rather than the router, so the guard lifts in
    // a render before anything is dismissed. Leaving from here would put a `back()` in
    // front of a guard that is still armed, and the stack would ask it - so the person
    // would answer "Discard changes?" a second time for the same Cancel.
    const leave = () => setLeaving(true);
    if (phase !== "editing" || !dirty) leave();
    else askDiscard(leave);
  }, [phase, dirty, askDiscard]);

  // Retrying is something a person did, so it may say so at once.
  const reload = useCallback(() => {
    setPhase("loading");
    setDetail("");
    void load();
  }, [load]);

  return {
    create,
    blocks,
    stepped,
    walk,
    stages,
    at,
    dirty,
    stepperWords,
    next,
    back,
    go,
    skip,
    held,
    errors,
    detail,
    awaiting,
    refusals,
    phase,
    change,
    fieldRefused,
    save,
    cancel,
    reload,
  };
}
