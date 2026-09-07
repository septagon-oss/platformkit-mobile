// useSingleton is the one row a tenant has of a resource that has no
// collection: site settings, and whatever else a module mounts as one.
//
// It is not useResourceDetail with the id left out. A singleton's row is at the
// entry's own path, its write is a PUT of the whole of it, and there is nothing
// to create or delete — so the screen has no list above it and no New or Delete
// on it, which is exactly what the catalog's `singleton` flag exists to say.
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { key, type Entry } from "../core/catalog";
import { formControls, problems, values, type Row } from "../core/derive";
import { ApiError } from "../effects/api";
import { useShell } from "../shell";
import type { Phase } from "../ui/organisms/ResourceForm";

export function useSingleton(entry: Entry) {
  const { api, wrote } = useShell();
  const [row, setRow] = useState<Row | undefined>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [held, setHeld] = useState<Readonly<Record<string, string>>>({});
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [detail, setDetail] = useState("");
  const [editing, setEditing] = useState(false);
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
      setPhase("failed");
      setDetail(e instanceof Error ? e.message : "This could not be read.");
    }
  }, [api, entry]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const controls = useMemo(() => formControls(entry, row, false), [entry, row]);
  const change = useCallback((name: string, value: string) => {
    setHeld((was) => ({ ...was, [name]: value }));
  }, []);

  const edit = useCallback(() => {
    setHeld({});
    setErrors({});
    setDetail("");
    setEditing(true);
  }, []);

  const cancel = useCallback(() => setEditing(false), []);

  const save = useCallback(async () => {
    const wrong = problems(controls, held);
    if (Object.keys(wrong).length > 0) {
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
      if (e instanceof ApiError) {
        setErrors(e.fields);
        setDetail(e.detail || "That could not be saved.");
        return;
      }
      setDetail(e instanceof Error ? e.message : "That could not be saved.");
    }
  }, [api, entry, controls, held, wrote]);

  return {
    row,
    controls,
    held,
    errors,
    detail,
    phase,
    editing,
    change,
    edit,
    cancel,
    save,
    reload: load,
  };
}
