// useResourceForm is the sheet's imperative shell. Its phase is explicit:
// loading the row to edit, failed to, editing, saving, saved. Save exists only
// while editing, so a form that never loaded cannot save an empty row over
// one; a dirty sheet asks before it is dismissed, by gesture as well as by
// button; a sheet that is saving cannot be dismissed at all; and a sheet that
// has saved leaves without asking.
import { usePreventRemove, useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { key, type Entry } from "../core/catalog";
import { formControls, problems, screenPath, text, values, type Row } from "../core/derive";
import { ApiError } from "../effects/api";
import { useShell } from "../shell";
import type { Phase } from "../ui/organisms/ResourceForm";

export function useResourceForm(entry: Entry, id: string | undefined) {
  const { api, wrote } = useShell();
  const router = useRouter();
  const navigation = useNavigation();
  const create = !id;
  const [row, setRow] = useState<Row | undefined>();
  const [phase, setPhase] = useState<Phase>(create ? "editing" : "loading");
  const [held, setHeld] = useState<Readonly<Record<string, string>>>({});
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [detail, setDetail] = useState("");
  const [saved, setSaved] = useState<Row | undefined>();
  const generation = useRef(0);

  const load = useCallback(async () => {
    if (!id) return;
    const started = ++generation.current;
    setPhase("loading");
    setDetail("");
    try {
      const got = await api.get(entry, id);
      if (generation.current !== started) return;
      setRow(got);
      setPhase("editing");
    } catch (e) {
      if (generation.current !== started) return;
      setDetail(e instanceof Error ? e.message : "This record could not be read.");
      setPhase("failed");
    }
  }, [api, entry, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const controls = useMemo(() => formControls(entry, row, create), [entry, row, create]);
  const dirty = Object.keys(held).length > 0;

  // usePreventRemove is what a native stack honours: it covers the swipe and
  // the system back as well as the header's Cancel. The saved phase does not
  // block, so leaving after a save asks nothing.
  usePreventRemove(phase === "saving" || (phase === "editing" && dirty), ({ data }) => {
    // A save in flight is never interrupted; the alert would have nothing
    // useful to offer while the request decides.
    if (phase === "saving") return;
    Alert.alert("Discard changes?", "What you typed here will be lost.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  // Leaving happens after the render that cleared the guard above.
  useEffect(() => {
    if (phase !== "saved") return;
    const at = screenPath(entry);
    // A sheet opened from a link has nothing to go back to; the record it just
    // wrote is where it belongs.
    if (create && saved) router.replace(`${at}/${encodeURIComponent(text(saved.id))}`);
    else if (router.canGoBack()) router.back();
    else if (id) router.replace(`${at}/${encodeURIComponent(id)}`);
    else router.replace(at);
  }, [phase, saved, create, entry, id, router]);

  const change = (name: string, value: string) => {
    setHeld((h) => ({ ...h, [name]: value }));
    if (errors[name]) setErrors(({ [name]: _, ...rest }) => rest);
  };

  const save = async () => {
    if (phase !== "editing") return;
    const refused = problems(controls, held);
    if (Object.keys(refused).length > 0) {
      setErrors(refused);
      setDetail("Some fields need attention.");
      return;
    }
    setPhase("saving");
    setDetail("");
    try {
      const body = values(controls, held);
      const written = id ? await api.update(entry, id, body) : await api.create(entry, body);
      wrote(key(entry));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(written);
      setPhase("saved");
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields);
        setDetail(e.detail || "That could not be saved.");
      } else {
        setDetail(e instanceof Error ? e.message : "That could not be saved.");
      }
      setPhase("editing");
    }
  };

  const cancel = () => {
    if (router.canGoBack()) router.back();
    else router.replace(screenPath(entry));
  };

  return { create, controls, held, errors, detail, phase, change, save, cancel, reload: load };
}
