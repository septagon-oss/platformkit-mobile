// useResourceDetail is the detail's imperative shell: one row, re-read when
// this app wrote to the resource while a sheet was above, and the delete,
// confirmed by the platform's own dialog with a warning felt before it and a
// success felt after.
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { key, type Entry } from "../core/catalog";
import { screenPath, type Row } from "../core/derive";
import { useShell } from "../shell";

export function useResourceDetail(entry: Entry, id: string | undefined) {
  const { api, writes, wrote } = useShell();
  const router = useRouter();
  const k = key(entry);
  const [row, setRow] = useState<Row | undefined>();
  const [error, setError] = useState("");
  const generation = useRef(0);
  const seen = useRef(writes[k] ?? 0);

  const load = useCallback(async () => {
    if (!id) return;
    const started = ++generation.current;
    try {
      const got = await api.get(entry, id);
      if (generation.current !== started) return;
      setRow(got);
      setError("");
    } catch (e) {
      if (generation.current !== started) return;
      setError(e instanceof Error ? e.message : "This record could not be read.");
    }
  }, [api, entry, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const now = writes[k] ?? 0;
      if (now !== seen.current) {
        seen.current = now;
        void load();
      }
    }, [writes, k, load]),
  );

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace(screenPath(entry));
  };

  const remove = () => {
    if (!id) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Are you sure?", `This deletes the ${entry.entity}. It cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.remove(entry, id);
            wrote(k);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            leave();
          } catch (e) {
            setError(e instanceof Error ? e.message : "That could not be deleted.");
          }
        },
      },
    ]);
  };

  return { row, error, reload: load, remove };
}
