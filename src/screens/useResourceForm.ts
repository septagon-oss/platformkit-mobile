// useResourceForm is the sheet's imperative shell. Its phase is explicit:
// loading the row to edit, failed to, editing, saving. Save exists only while
// editing, so a form that never loaded cannot save an empty row over one; a
// dirty sheet asks before it is dismissed; a saved one leaves without asking.
import { useNavigation, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
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
  const leaving = useRef(false);
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

  // Dismissing a dirty sheet, by gesture, header or system back, asks first.
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (leaving.current || !dirty) return;
        e.preventDefault();
        if (phase === "saving") return;
        Alert.alert("Discard changes?", "What you typed here will be lost.", [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]);
      }),
    [navigation, dirty, phase],
  );

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
      const saved = id ? await api.update(entry, id, body) : await api.create(entry, body);
      wrote(key(entry));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      leaving.current = true;
      if (create) router.replace(`${screenPath(entry)}/${encodeURIComponent(text(saved.id))}`);
      else router.back();
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

  const cancel = () => router.back();

  return { create, controls, held, errors, detail, phase, change, save, cancel, reload: load };
}
