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
  isFinished,
  label,
  nounPhrase,
  presentedTime,
  screenPath,
  verbRefusal,
  writePath,
  type Clock,
  type FailureContext,
  type FailureVerdict,
  type Formatting,
  type Row,
} from "../core/derive";
import { address } from "../core/reentry";
import { keyed, rowAddress } from "../effects/api";
import { answered } from "../effects/read-cache";
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
  const { api, writes, wrote, heard, celebrating, celebrated, outbox, reads } = useShell();
  const { mode } = useTheme();
  const router = useRouter();
  // The three format fields this hook reads are strings and a frozen bundle, so
  // they stay stable between renders; the `format` object itself is rebuilt on
  // every one, and a load keyed by it would re-read the row forever.
  const { copy, locale, timeZone, ownZone } = format;
  const k = key(entry);
  const [row, setRow] = useState<Row | undefined>();
  // When this phone last received the row on screen, and nothing when the server
  // sent it: a record read on the train is shown in the tunnel, and says so.
  const [savedAt, setSavedAt] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");
  const [refusal, setRefusal] = useState<FailureVerdict | undefined>();
  // The sentence a write said, read once from the shell as this record comes into
  // focus. It is drawn beside the row it is about and then gone: a record says what
  // its write did once, not on every visit afterwards.
  const [saved, setSaved] = useState("");
  // The row whose state this phone's own write crossed into one the entry calls finished, and
  // nothing when nothing was crossed. It is held for the visit the way `saved` is: a record says
  // once what its own write did, and a record read in its finished state from the first moment says
  // nothing, because for it nothing crossed. What the row *says* is read from it by the screen that
  // draws it, in the reader's own formatting, and never from a copy kept here.
  const [reached, setReached] = useState<Row | undefined>(undefined);
  // Whether the burst drawn over this record is still playing. It is one drawn thing with a
  // ceiling, so the surface that draws it says when it is over; nothing the record says depends
  // on that answer, and no read waits for it.
  const [bursting, setBursting] = useState(false);
  // The record's `…` is open. The button sits in the native header and the rows it
  // opens in the body, so the state lives where both can reach it, and Delete closes
  // it as it asks its question — a platform dialog drawn over a menu that is still
  // open would leave the person answering two things at once.
  const [menu, setMenu] = useState(false);
  const generation = useRef(0);
  const [visit, setVisit] = useState(0);
  const seen = useRef(writes[k] ?? 0);
  // The row this screen last drew — the half of the crossing test no read can supply. Only this
  // screen knows what it showed a moment ago, so only it can tell a state that changed from one
  // that arrived already changed.
  const drawn = useRef<Row | undefined>(undefined);
  // Whether a write this phone made filed a moment for this record. The shell keeps the one-shot;
  // this is this screen's read of it, spent by the next read that answers, crossed or not, so a
  // filing can never sit waiting through a slow answer and fire over a record the person stopped
  // looking at. The words a moment speaks are made in `format`, which is rebuilt on every render
  // and so is read through a ref rather than becoming a dependency of the read below.
  const filing = useRef(false);
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
      setVisit(started);
      try {
        // The row comes from the cache when the server cannot be reached, so a
        // record a person read on the train is still on the screen in the tunnel.
        const got = await answered(
          reads,
          { kind: "row", resourceKey: k, path: rowAddress(entry, id) },
          "",
          () => api.get(entry, id),
        );
        if (generation.current !== started) return;
        // The two halves meet here: the filing says this phone wrote, the rows say the state
        // crossed, and an answer this phone merely stored counts as no answer at all. The filing is
        // spent either way, so a state the server reached on its own and a state this person
        // already celebrated are both answered with silence.
        const caused = filing.current;
        filing.current = false;
        const crossed =
          caused &&
          drawn.current !== undefined &&
          got.source !== "device" &&
          isFinished(entry, got.value) &&
          !isFinished(entry, drawn.current);
        drawn.current = got.value;
        setRow(got.value);
        setSavedAt(got.source === "device" ? got.savedAt : undefined);
        setError("");
        setRefusal(undefined);
        read.current = clock.now();
        if (crossed) {
          setReached(got.value);
          setBursting(true);
        }
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
    [api, reads, entry, id, k, copy, locale, timeZone, ownZone, clock],
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
      const at = address("detail", entry, id);
      const said = heard(at);
      // A focus that heard nothing has nothing to say. The sentence belongs to the
      // visit it was heard in: a person who comes back to this record by way of a
      // sheet that wrote nothing is not told again what an earlier write did.
      setSaved(said);
      const now = writes[k] ?? 0;
      if (now !== seen.current) {
        seen.current = now;
        // A write this phone made filed that it wrote here; the filing is taken now and spent by
        // the read below. A reconciliation with no filing behind it — another person's change, a
        // pull to refresh — is a read, and a read celebrates nothing.
        if (celebrating(at)) {
          celebrated(at);
          filing.current = true;
        }
        void load("refresh");
      }
    }, [writes, k, load, heard, celebrating, celebrated, entry, id]),
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
            const live = (idem?: string) => api.remove(entry, id, ...keyed(idem));
            const answer = outbox
              ? await outbox.submit(
                  {
                    kind: "delete",
                    resourceKey: k,
                    path: `${writePath(entry)}/${encodeURIComponent(id)}`,
                  },
                  live,
                )
              : { sent: true as const, row: await live() };
            // A delete this phone is holding is still a delete the person asked
            // for: they leave the record either way, and the row shows what is owed.
            if (answer.sent) wrote(k);
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
  }, [id, entry, row, api, wrote, k, leave, mode, copy, outbox]);

  // Retry reads the row again; reconcile reads it too, and is what an unanswered
  // write offers instead of sending the same write a second time. Dismiss puts the
  // sentence away and leaves what it was about on screen.
  const reload = useCallback(() => void load(read.current ? "refresh" : "read"), [load]);
  const dismiss = useCallback(() => {
    setError("");
    setRefusal(undefined);
  }, []);

  const toggleMenu = useCallback(() => setMenu((open) => !open), []);

  // The burst is over: the drawn thing goes away and what the record said stays said.
  const burstOver = useCallback(() => setBursting(false), []);

  return {
    visit,
    row,
    savedAt,
    error,
    refusal,
    saved,
    reached,
    bursting,
    burstOver,
    reload,
    dismiss,
    remove,
    leave,
    menu,
    toggleMenu,
  };
}
