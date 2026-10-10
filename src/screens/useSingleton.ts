// useSingleton is the one row a tenant has of a resource that has no
// collection: site settings, and whatever else a module mounts as one.
//
// It is not useResourceDetail with the id left out. A singleton's row is at the
// entry's own path, its write is a PUT of the whole of it, and there is nothing
// to create or delete — which is exactly what the catalog's `singleton` flag
// says, and why the screen has no list above it and no New or Delete on it.
//
// The form it draws is the sheet's own lifecycle: Edit exists only once the row
// has been read, Save rechecks that from inside itself, a dirty draft is thrown
// away only after the person says so, values survive every failure, and the one
// row it wrote says so in words on the record underneath.
import * as Haptics from "expo-haptics";
import { useNavigation } from "expo-router";
// The navigation hook that a native stack honours moved inside the router's
// own re-export of react-navigation in SDK 57.
import { usePreventRemove } from "expo-router/react-navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { key, offers, type Entry } from "../core/catalog";
import {
  changedFields,
  failureSubject,
  firstProblem,
  formSections,
  problems,
  values,
  verbRefusal,
  writeControls,
  type Row,
} from "../core/derive";
import { useShell } from "../shell";
import { confirm } from "../ui/chooser";
import type { Phase } from "../ui/organisms/ResourceForm";
import { useTheme } from "../ui/theme";
import { refusalFields, refusalOf, screenCopy } from "./failure";

export function useSingleton(entry: Entry) {
  const { api, wrote } = useShell();
  const { mode } = useTheme();
  const navigation = useNavigation();
  const [row, setRow] = useState<Row | undefined>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [held, setHeld] = useState<Readonly<Record<string, string>>>({});
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [detail, setDetail] = useState("");
  // The field the form is waiting on: the first one it asks for that carries a
  // sentence. See `useResourceForm` for the rule; this is the same rule at the
  // other address a protected form is drawn at.
  const [awaiting, setAwaiting] = useState("");
  // How many times this form has refused: the second refusal of the same field names
  // the same field, and it takes the count to make it a new request for the box. See
  // `useResourceForm`, which holds the rule; this is the same rule at the other
  // address a protected form is drawn at.
  const [refusals, setRefusals] = useState(0);
  // The sentence the write said. This screen does not navigate when it saves — the
  // record is the same screen as its own form — so the sentence has somewhere to be
  // drawn without the shell carrying it anywhere.
  const [saved, setSaved] = useState("");
  const [editing, setEditing] = useState(false);
  const copy = screenCopy();
  const generation = useRef(0);
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
    const started = ++generation.current;
    try {
      const got = await api.one(entry);
      if (generation.current !== started) return;
      setRow(got);
      setPhase("editing");
      setDetail("");
    } catch (e) {
      if (generation.current !== started) return;
      const said = refusalOf(e, "read", failureSubject(entry), copy);
      if (said.verdict.outcome === "silent") return;
      setPhase("failed");
      setDetail(said.text);
    }
  }, [api, entry, copy]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const blocks = useMemo(
    () => formSections(entry, row, false, copy.kit.overview),
    [entry, row, copy.kit.overview],
  );
  const controls = useMemo(() => blocks.flatMap((b) => b.controls), [blocks]);
  const change = useCallback((name: string, value: string) => {
    setHeld((was) => ({ ...was, [name]: value }));
    setErrors(({ [name]: _, ...rest }) => rest);
    setAwaiting((was) => (was === name ? "" : was));
  }, []);
  // Dirty means changed, not touched — the same predicate the sheet and a command's
  // argument use, so typing a value and putting it back never asks the question.
  const dirty = changedFields(controls, held).length > 0;
  // A box that will not store what it holds says so here, and the save below meets
  // the same answer as a `problems` refusal: nothing leaves while a field the person
  // is being asked to fix still stands. See `useResourceForm` for the full rule.
  const refusing = useRef<Readonly<Record<string, boolean>>>({});
  const fieldRefused = useCallback((name: string, refused: boolean) => {
    if ((refusing.current[name] ?? false) === refused) return;
    const next = { ...refusing.current };
    if (refused) next[name] = true;
    else delete next[name];
    refusing.current = next;
  }, []);

  // A draft that is thrown away holds no refusal either. The box that refused clears
  // its own report when the person corrects the word, but this screen *unmounts* the
  // form on cancel, so that correction can never arrive: a report left standing here
  // would outlive the draft it was about and silently block the next valid save.
  const discardDraft = () => {
    setHeld({});
    setErrors({});
    setDetail("");
    setAwaiting("");
    refusing.current = {};
  };

  const edit = useCallback(() => {
    discardDraft();
    setSaved("");
    setEditing(true);
  }, []);

  // The one question this screen asks, in the copy table's words: the same two
  // answers the sheet's gesture asks for, because it is the same thing at stake.
  const askDiscard = useCallback(
    (discard: () => void) => {
      confirm(
        copy.kit.discardChanges,
        { label: copy.kit.discard, destructive: true, onPress: discard },
        mode,
        { message: copy.kit.discardUnsaved, cancel: copy.kit.keepEditing },
      );
    },
    [copy, mode],
  );

  const stopEditing = useCallback(() => {
    discardDraft();
    setEditing(false);
  }, []);

  // Cancel is a door out of a dirty draft, so it asks. The record underneath is what
  // the read returned either way, and an answer of "Keep editing" changes nothing.
  const cancel = useCallback(() => {
    if (dirty) askDiscard(stopEditing);
    else stopEditing();
  }, [dirty, askDiscard, stopEditing]);

  // The swipe and the system back are the other two doors. This screen is the record
  // and its form at once, so the guard is registered only while the form is open over
  // a changed draft: a guard that never lifted would make the record undismissable.
  usePreventRemove(phase === "editing" && editing && dirty, ({ data }) =>
    askDiscard(() => {
      stopEditing();
      navigation.dispatch(data.action);
    }),
  );

  const save = useCallback(async () => {
    // Save is drawn from doors(entry); what this rechecks for a form reached any
    // other way is the verb half of that rule, `offers` — whether this caller may
    // write stays the server's answer. A singleton's PUT is an update of its one
    // row, and a resource that mounts no update has no address for it.
    if (!offers(entry, "update")) {
      setDetail(verbRefusal("update"));
      return;
    }
    // A form over a row that was never read has nothing to replace: a PUT of what
    // is on screen would be a PUT over a row this app has not seen. The Edit button
    // that would reach this state is not drawn; this is the same rule from inside.
    if (phase !== "editing") return;
    const wrong = problems(controls, held, copy.kit);
    if (Object.keys(wrong).length > 0 || Object.keys(refusing.current).length > 0) {
      setErrors(wrong);
      setDetail(copy.kit.validation);
      setAwaiting(firstProblem(controls, wrong) ?? "");
      setRefusals((n) => n + 1);
      return;
    }
    setPhase("saving");
    setDetail("");
    setAwaiting("");
    try {
      // A PUT replaces the whole of it, so the body is every field this client may
      // write — the ones the form drew and the ones it was never shown — and not
      // only the ones somebody touched. `writeControls` is that rule; `values` is
      // the same coercion it has always used.
      const written = await api.replace(entry, values(writeControls(entry, row, controls), held));
      if (!alive.current) return;
      setRow(written);
      setHeld({});
      setErrors({});
      setEditing(false);
      setPhase("editing");
      setSaved(copy.kit.changesSaved);
      wrote(key(entry));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      if (!alive.current) return;
      setPhase("editing");
      const said = refusalOf(e, "update", failureSubject(entry), copy);
      if (said.verdict.outcome === "silent") return;
      // Every value the person typed stays where it is: no failure path touches
      // `held`. A 422 that named its fields colours those fields and asks for the
      // first of them; anything else says what this app knows and no more.
      const fields = refusalFields(said.verdict);
      setErrors(fields);
      setDetail(said.text);
      setAwaiting(firstProblem(controls, fields) ?? "");
      setRefusals((n) => n + 1);
    }
  }, [api, entry, row, controls, held, wrote, copy, phase]);

  return {
    row,
    blocks,
    held,
    errors,
    detail,
    awaiting,
    refusals,
    saved,
    fieldRefused,
    phase,
    editing,
    dirty,
    change,
    edit,
    cancel,
    save,
    reload: load,
  };
}
