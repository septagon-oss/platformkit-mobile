// useResourceDetail is the detail's imperative shell: one row, re-read when
// this app wrote to the resource while a sheet was above, and the delete,
// confirmed by the platform's own dialog with a warning felt before it and a
// success felt after.
//
// A refusal is classified, not printed: whether the record stays on the screen is
// decided by the verdict (`withdraws`), so a refresh answered 403 takes the row
// away and a refresh answered 503 keeps it under "showing the last update from".
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { key, offers, type Entry } from "../core/catalog";
import {
  failureSubject,
  instantValue,
  label,
  nounPhrase,
  presentedTime,
  screenPath,
  verbRefusal,
  type Clock,
  type FailureContext,
  type FailureVerdict,
  type Formatting,
  type Row,
} from "../core/derive";
import { address } from "../core/reentry";
import { useShell } from "../shell";
import { confirm } from "../ui/chooser";
import { useTheme } from "../ui/theme";
import { systemClock } from "./clock";
import { refusalOf } from "./failure";

export function useResourceDetail(
  entry: Entry,
  id: string | undefined,
  format: Formatting,
  clock: Clock = systemClock,
) {
  const { api, writes, wrote, heard } = useShell();
  const { mode } = useTheme();
  const router = useRouter();
  // The three format fields this hook reads are strings and a frozen bundle, so
  // they stay stable between renders; the `format` object itself is rebuilt on
  // every one, and a load keyed by it would re-read the row forever.
  const { copy, locale, timeZone, ownZone } = format;
  const k = key(entry);
  const [row, setRow] = useState<Row | undefined>();
  const [error, setError] = useState("");
  const [refusal, setRefusal] = useState<FailureVerdict | undefined>();
  // The sentence a write said, read once from the shell as this record comes into
  // focus. It is drawn beside the row it is about and then gone: a record says what
  // its write did once, not on every visit afterwards.
  const [saved, setSaved] = useState("");
  // The record's `…` is open. The button sits in the native header and the rows it
  // opens in the body, so the state lives where both can reach it, and Delete closes
  // it as it asks its question — a platform dialog drawn over a menu that is still
  // open would leave the person answering two things at once.
  const [menu, setMenu] = useState(false);
  const generation = useRef(0);
  const seen = useRef(writes[k] ?? 0);
  // The instant of the last read that answered. A refresh names it, and while it
  // is empty there is nothing to name — which is why an unread refresh is a read.
  const read = useRef("");

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(screenPath(entry));
  }, [router, entry]);

  const load = useCallback(
    async (why: FailureContext = "read") => {
      if (!id) return;
      const started = ++generation.current;
      try {
        const got = await api.get(entry, id);
        if (generation.current !== started) return;
        setRow(got);
        setError("");
        setRefusal(undefined);
        read.current = clock.now();
      } catch (e) {
        if (generation.current !== started) return;
        const at = instantValue(read.current);
        const said = at ? presentedTime(at, { locale, timeZone, ownZone }) : "";
        const verdict = refusalOf(e, why, failureSubject(entry, "", said), copy);
        if (verdict.verdict.outcome === "silent") return;
        if (verdict.withdraws) {
          setRow(undefined);
          read.current = "";
          // The menu opens over a row. A row that is gone takes the menu with it,
          // and the sentence about the access says the rest.
          setMenu(false);
        }
        setError(verdict.text);
        setRefusal(verdict.verdict);
      }
    },
    [api, entry, id, copy, locale, timeZone, ownZone, clock],
  );

  useEffect(() => {
    // The await is spelled out here rather than hidden behind a call, so it is
    // plain that nothing is set during the render this effect runs after.
    void (async () => {
      await load("read");
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      // Whoever wrote here said what the write did; this is the screen that lands on
      // it, and the focus that reconciles the write counter is the moment to hear it.
      const said = heard(address("detail", entry, id));
      // A focus that heard nothing has nothing to say. The sentence belongs to the
      // visit it was heard in: a person who comes back to this record by way of a
      // sheet that wrote nothing is not told again what an earlier write did.
      setSaved(said);
      const now = writes[k] ?? 0;
      if (now !== seen.current) {
        seen.current = now;
        void load("refresh");
      }
    }, [writes, k, load, heard, entry, id]),
  );

  const remove = useCallback(() => {
    if (!id) return;
    // Delete is drawn from doors(entry); the verb half of that rule, `offers`,
    // is what a call made from anywhere else rechecks — the server is what
    // answers a caller who may not write. A resource with no delete has no
    // address to send one to, so the question is never even asked.
    if (!offers(entry, "delete")) {
      setError(verbRefusal("delete"));
      return;
    }
    setMenu(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // The record is named by the field that names it everywhere else, and the
    // warning says what this app cannot do, which is less than "permanently":
    // a soft-deleting resource stays recoverable to the person who holds it.
    confirm(
      copy.kit.deleteQuestion(label(entry, row ?? {}, copy.kit.untitled)),
      {
        label: copy.kit.deleteAction(nounPhrase(entry).singular),
        destructive: true,
        onPress: async () => {
          try {
            await api.remove(entry, id);
            wrote(k);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            leave();
          } catch (e) {
            const verdict = refusalOf(e, "delete", failureSubject(entry), copy);
            if (verdict.verdict.outcome === "silent") return;
            if (verdict.withdraws) setRow(undefined);
            setError(verdict.text);
            setRefusal(verdict.verdict);
          }
        },
      },
      mode,
      { message: copy.kit.deleteWarning, cancel: copy.kit.cancel },
    );
  }, [id, entry, row, api, wrote, k, leave, mode, copy]);

  // Retry reads the row again; reconcile reads it too, and is what an unanswered
  // write offers instead of sending the same write a second time. Dismiss puts the
  // sentence away and leaves what it was about on screen.
  const reload = useCallback(() => void load(read.current ? "refresh" : "read"), [load]);
  const dismiss = useCallback(() => {
    setError("");
    setRefusal(undefined);
  }, []);

  const toggleMenu = useCallback(() => setMenu((open) => !open), []);

  return {
    row,
    error,
    refusal,
    saved,
    reload,
    dismiss,
    remove,
    leave,
    menu,
    toggleMenu,
  };
}
