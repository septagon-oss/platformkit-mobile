// Home is the catalog as rows, with the account in the native header: the
// platform's own menu offers Refresh and Sign out.
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useRecordPeople } from "./useReferenceNames";
import { usePictures } from "./usePictures";
import { useFeedback } from "./useFeedback";
import { useSignOut } from "./useSignOut";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { key, type Entry } from "../core/catalog";
import {
  screenPath,
  accountPerson,
  accountPointers,
  avatar,
  greeting,
  nameKey,
  workspaceName,
  type Presentation,
} from "../core/derive";
import { rowCounts, statCards } from "../core/summary";
import { recentHref, type Recent, type RecentDoor } from "../core/recents";
import { heldWriteView } from "../core/outbox";
import { useShell } from "../shell";
import { useOperation } from "./useOperation";
import { Button } from "../ui/atoms/Button";
import { choose } from "../ui/chooser";
import { Home as HomeView } from "../ui/organisms/Home";
import { WorkspaceMark } from "./WorkspaceMark";
import { useTheme } from "../ui/theme";

interface Props {
  readonly entries: readonly Entry[];
}

export function Home({ entries }: Props) {
  const feedback = useFeedback();
  const {
    refresh,
    baseURL,
    identity,
    outbox,
    state,
    recents,
    writes,
    workspace: shellWorkspace,
  } = useShell();
  const pointers = useMemo(
    () => accountPointers(state.catalog?.resources ?? [], identity?.userId),
    [state.catalog, identity?.userId],
  );
  const { people } = useRecordPeople(pointers);
  const person = identity
    ? accountPerson(identity, people[nameKey("user/user", identity.userId)])
    : undefined;
  const media = usePictures(person?.portrait ? [person.portrait] : []);
  const leave = useSignOut();
  const { mode } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  // The counts are one read of the whole workspace, asked once when Home opens. It has
  // no parameters to get wrong and no filter to invent: the installation answers for
  // what this person may read and nothing else.
  const { data: counted, reload: rereadCounts } = useOperation("appSummary", {});
  // What this device remembers this person opened is the phone's own list, so it is read
  // where it is drawn: on every focus, which is also the first time it is asked. A record
  // came back from is in the section as soon as the page is in front of the person again,
  // and a build that keeps no list has no list to read.
  const [remembered, setRemembered] = useState<readonly Recent[]>([]);
  const rereadRecents = useCallback(async () => {
    const opened = recents ? await recents.list() : [];
    setRemembered(opened);
  }, [recents]);
  useFocusEffect(
    useCallback(() => {
      void rereadRecents();
    }, [rereadRecents]),
  );
  // How many writes this app made to the resources these counts count. The body is the
  // workspace's *now*, so a save made behind Home — a record created, a row deleted — is
  // what makes the number on screen a claim about a moment that has passed: coming back
  // asks the one question again. `countedBefore` is the total the numbers on screen were
  // read against, and a write always happens on the screen that made it, so the total can
  // only ever have moved by the time this screen is in front of the person again — which
  // is why a pull, needing no such permission, never reads twice.
  const written = useMemo(
    () => entries.reduce((sum, entry) => sum + (writes[key(entry)] ?? 0), 0),
    [entries, writes],
  );
  const countedBefore = useRef(written);
  useFocusEffect(
    useCallback(() => {
      if (written === countedBefore.current) return;
      countedBefore.current = written;
      void rereadCounts();
    }, [written, rereadCounts]),
  );
  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      // One pull, one spinner, both reads: the catalogue and its counts are the same
      // question — what is there now — asked of two documents.
      await Promise.all([refresh(), rereadCounts()]);
    } finally {
      setRefreshing(false);
    }
  }, [refresh, rereadCounts]);
  // Every held write the person can see, said by the projection that owns the
  // sentence, so a phone that lost its network shows what it owes rather than
  // looking like it saved the work.
  const held = useMemo(
    () => (outbox?.items ?? []).map((item) => heldWriteView(item, feedback)),
    [outbox, feedback],
  );
  const retryHeld = useCallback((id: string) => void outbox?.retry(id), [outbox]);
  const discardHeld = useCallback((id: string) => void outbox?.discard(id), [outbox]);
  // A Presentation, not a Feedback: a count is formatted, so the reader's week and
  // motion travel with the locale the numbers are read in.
  const presentation: Presentation = useMemo(() => ({ ...feedback, weekStartsOn: 1 }), [feedback]);
  const hello = greeting(person, presentation);
  const workspace = workspaceName(baseURL, feedback.copy, shellWorkspace.name);
  // Both are a pure join of the answered body with the caller's catalogue, so a read
  // that refused leaves both empty rather than stale: a count with no stated age is a
  // claim about now, and the rows keep what they always drew.
  const cards = useMemo(
    () => statCards(counted, entries, presentation),
    [counted, entries, presentation],
  );
  const counts = useMemo(
    () => rowCounts(counted, entries, presentation),
    [counted, entries, presentation],
  );
  // A remembered open is only a door while the catalogue still hands over that resource:
  // a record whose entry this person was not given drops out rather than drawing a row
  // that opens nothing.
  const recentDoors = useMemo<readonly RecentDoor[]>(
    () =>
      remembered.flatMap((recent) => {
        const entry = entries.find((e) => key(e) === recent.resourceKey);
        return entry ? [{ recent, entry }] : [];
      }),
    [remembered, entries],
  );
  const account = useCallback(
    () =>
      choose(
        identity?.email || feedback.copy.kit.account,
        [
          { label: feedback.copy.kit.refresh, onPress: () => void reload() },
          // The door itself belongs to useSignOut, which asks while this phone
          // holds work: the count, the words and the yes are one rule, kept once.
          { label: feedback.copy.kit.signOut, onPress: leave, destructive: true },
        ],
        mode,
      ),
    [reload, leave, mode, identity?.email, feedback.copy.kit],
  );
  // The options are memoised because the navigator is told them on every
  // render: a fresh object, with fresh callbacks in it, is a new instruction
  // each time and the renders never settle.
  const options = useMemo(
    () => ({
      // The workspace's name, by the one rule the band's second line reads too, so the
      // header and the page cannot call the same place two things.
      title: workspace,
      headerRight: () => (
        <Button
          placement="header"
          label={feedback.copy.kit.account}
          icon="person"
          onPress={account}
          testID="account"
        />
      ),
    }),
    [account, feedback.copy.kit.account, workspace],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <HomeView
        feedback={feedback}
        entries={entries}
        refreshing={refreshing}
        account={identity?.email}
        person={person ? avatar(person, media.states, media.enabled) : undefined}
        greeting={hello.line}
        workspace={workspace}
        mark={
          shellWorkspace.logoPath === undefined ? null : (
            <WorkspaceMark description={feedback.copy.kit.workspaceMark(workspace)} />
          )
        }
        cards={cards}
        counts={counts}
        {...(recents === undefined ? {} : { recents: recentDoors })}
        {...(media.enabled ? { renderImage: media.renderImage } : {})}
        held={held}
        onRetryHeld={retryHeld}
        onDiscardHeld={discardHeld}
        onOpen={(e) => router.push(screenPath(e))}
        onOpenRecent={(door) => router.push(recentHref(door))}
        onRefresh={() => void reload()}
      />
    </>
  );
}
