// useSingleton is the one row a tenant has of a resource that has no
// collection: site settings, and whatever else a module mounts as one.
//
// It is not useResourceDetail with the id left out. A singleton's row is at the
// entry's own path, its write is a PUT of the whole of it, and there is nothing
// to create or delete — so the screen has no list above it and no New or Delete
// on it, which is exactly what the catalog's `singleton` flag exists to say.
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { key, offers, type Entry } from "../core/catalog";
import {
  failureSubject,
  formSections,
  problems,
  values,
  verbRefusal,
  type Row,
} from "../core/derive";
import { useShell } from "../shell";
import type { Phase } from "../ui/organisms/ResourceForm";
import { refusalFields, refusalOf, screenCopy } from "./failure";

export function useSingleton(entry: Entry) {
  const { api, wrote } = useShell();
  const [row, setRow] = useState<Row | undefined>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [held, setHeld] = useState<Readonly<Record<string, string>>>({});
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [detail, setDetail] = useState("");
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
  }, []);
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

  const edit = useCallback(() => {
    setHeld({});
    setErrors({});
    setDetail("");
    setEditing(true);
  }, []);

  const cancel = useCallback(() => setEditing(false), []);

  const save = useCallback(async () => {
    // Edit is drawn from doors(entry); what this rechecks for a sheet reached
    // any other way is the verb half of that rule, `offers` — whether this
    // caller may write stays the server's answer. A singleton's PUT is an update
    // of its one row, and a resource that mounts no update has no address for it.
    if (!offers(entry, "update")) {
      setDetail(verbRefusal("update"));
      return;
    }
    const wrong = problems(controls, held, copy.kit);
    if (Object.keys(wrong).length > 0 || Object.keys(refusing.current).length > 0) {
      setErrors(wrong);
      return;
    }
    setPhase("saving");
    try {
      // A PUT replaces the whole of it, so what is sent is every control's
      // value and not only the ones somebody touched.
      const saved = await api.replace(entry, values(controls, held));
      if (!alive.current) return;
      setRow(saved);
      setHeld({});
      setEditing(false);
      setPhase("editing");
      wrote(key(entry));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      if (!alive.current) return;
      setPhase("editing");
      const said = refusalOf(e, "update", failureSubject(entry), copy);
      if (said.verdict.outcome === "silent") return;
      setErrors(refusalFields(said.verdict));
      setDetail(said.text);
    }
  }, [api, entry, controls, held, wrote, copy]);

  return {
    row,
    blocks,
    held,
    errors,
    detail,
    fieldRefused,
    phase,
    editing,
    change,
    edit,
    cancel,
    save,
    reload: load,
  };
}
