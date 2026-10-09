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
  failureSubject,
  formControls,
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
  const { api, wrote, typed, keep } = useShell();
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

  const controls = useMemo(() => formControls(entry, row, create), [entry, row, create]);
  const dirty = Object.keys(held).length > 0;
  // The same contents, held for the callbacks that must not change identity: the
  // sheet puts Save and Cancel in the navigator's options, and an option rebuilt
  // on every render is an instruction the navigator repeats forever.
  const contents = useRef<Readonly<Record<string, string>>>(held);

  // usePreventRemove is what a native stack honours: it covers the swipe and
  // the system back as well as the header's Cancel. It guards the editing
  // phase only. While a save is in flight and after it lands, the screen is
  // dismissed by this app rather than by a person, and a guard that is still
  // registered then leaves the native screen refusing the dismissal it was
  // just asked for.
  usePreventRemove(phase === "editing" && dirty, ({ data }) => {
    confirm(
      "Discard changes?",
      {
        label: "Discard",
        destructive: true,
        onPress: () => {
          // Discarded means the shell keeps none of it either.
          keep(here, {});
          navigation.dispatch(data.action);
        },
      },
      mode,
      { message: "What you typed here will be lost.", cancel: "Keep editing" },
    );
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

  // Every callback this hook hands out is stable, because the screen puts them
  // in the options it gives the navigator, and options rebuilt on each render
  // are an instruction repeated forever.
  const change = useCallback(
    (name: string, value: string) => {
      contents.current = { ...contents.current, [name]: value };
      setHeld(contents.current);
      setErrors(({ [name]: _, ...rest }) => rest);
      keep(here, contents.current);
    },
    [here, keep],
  );

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
    const refused = problems(controls, held);
    if (Object.keys(refused).length > 0) {
      setErrors(refused);
      // The kit's own word for it: the sentence is the one the copy table holds.
      setDetail(copy.kit.validation);
      return;
    }
    setPhase("saving");
    setDetail("");
    try {
      const body = values(controls, held);
      const written = id ? await api.update(entry, id, body) : await api.create(entry, body);
      wrote(key(entry));
      if (!alive.current) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(written);
      setPhase("saved");
    } catch (e) {
      if (!alive.current) return;
      const said = refusalOf(e, create ? "create" : "update", failureSubject(entry), copy);
      if (said.verdict.outcome === "silent") return;
      // A 422 that named fields colours those fields and adds no sentence; an
      // unanswered save says what is honest — that nothing is known.
      setErrors(refusalFields(said.verdict));
      setDetail(said.text);
      setPhase("editing");
    }
  }, [phase, controls, held, id, api, entry, wrote, copy, create]);

  const cancel = useCallback(() => {
    keep(here, {});
    if (router.canGoBack()) router.back();
    else router.replace(screenPath(entry));
  }, [router, entry, here, keep]);

  // Retrying is something a person did, so it may say so at once.
  const reload = useCallback(() => {
    setPhase("loading");
    setDetail("");
    void load();
  }, [load]);

  return { create, controls, held, errors, detail, phase, change, save, cancel, reload };
}
