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
import {
  changedFields,
  failureSubject,
  firstProblem,
  formSections,
  noun,
  problems,
  screenPath,
  text,
  values,
  verbRefusal,
  type Row,
} from "../core/derive";
import { useShell } from "../shell";
import { confirm } from "../ui/chooser";
import type { Phase } from "../ui/organisms/ResourceForm";
import { useTheme } from "../ui/theme";
import { refusalFields, refusalOf, screenCopy } from "./failure";

export function useResourceForm(entry: Entry, id: string | undefined) {
  const { api, wrote, typed, keep, say } = useShell();
  const { mode } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const create = !id;
  const copy = screenCopy();
  // This sheet's own address, which is what the shell files what is typed under.
  const here = address("form", entry, id);
  const [row, setRow] = useState<Row | undefined>();
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
      const got = await api.get(entry, id);
      if (generation.current !== started) return;
      setRow(got);
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
  const blocks = useMemo(
    () => formSections(entry, row, create, copy.kit.overview),
    [entry, row, create, copy.kit.overview],
  );
  const controls = useMemo(() => blocks.flatMap((b) => b.controls), [blocks]);
  // Dirty means changed, not touched: a person who typed something and put it back
  // changed nothing, and asking them whether to throw it away wastes the question.
  const dirty = changedFields(controls, held).length > 0;
  // The same contents, held for the callbacks that must not change identity: the
  // sheet puts Save and Cancel in the navigator's options, and an option rebuilt
  // on every render is an instruction the navigator repeats forever.
  const contents = useRef<Readonly<Record<string, string>>>(held);

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
  usePreventRemove(phase === "editing" && dirty && !leaving, ({ data }) =>
    askDiscard(() => {
      // Discarded means the shell keeps none of it either.
      keep(here, {});
      navigation.dispatch(data.action);
    }),
  );

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

  const save = useCallback(async () => {
    if (phase !== "editing") return;
    // The header's New/Edit button is the door for this write, and it is drawn
    // from doors(entry). A sheet can also be reached by a link or a restored
    // stack, so the verb half of that rule is checked again here: a create the
    // resource does not mount has no address to POST to, and nothing is sent to
    // find out.
    if (!offers(entry, create ? "create" : "update")) {
      setDetail(verbRefusal(create ? "create" : "update"));
      return;
    }
    const refused = problems(controls, held, copy.kit);
    if (Object.keys(refused).length > 0 || Object.keys(refusing.current).length > 0) {
      setErrors(refused);
      // The kit's own word for it: the sentence is the one the copy table holds.
      setDetail(copy.kit.validation);
      setAwaiting(firstProblem(controls, refused) ?? "");
      setRefusals((n) => n + 1);
      return;
    }
    setPhase("saving");
    setDetail("");
    setAwaiting("");
    try {
      const body = values(controls, held);
      const written = id ? await api.update(entry, id, body) : await api.create(entry, body);
      wrote(key(entry));
      if (!alive.current) return;
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
    }
  }, [phase, controls, held, id, api, entry, wrote, copy, create, say]);

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
