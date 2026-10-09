// Home is the catalog as rows, with the account in the native header: the
// platform's own menu offers Refresh and Sign out.
import { Stack, useRouter } from "expo-router";
import { useFeedback } from "./useFeedback";
import React, { useCallback, useMemo, useState } from "react";
import type { Entry } from "../core/catalog";
import { hostLabel, screenPath } from "../core/derive";
import { useShell } from "../shell";
import { Button } from "../ui/atoms/Button";
import { choose } from "../ui/chooser";
import { Home as HomeView } from "../ui/organisms/Home";
import { useTheme } from "../ui/theme";

interface Props {
  readonly entries: readonly Entry[];
}

export function Home({ entries }: Props) {
  const feedback = useFeedback();
  const { refresh, signOut, baseURL, identity } = useShell();
  const { mode } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);
  const account = useCallback(
    () =>
      choose(
        "Account",
        [
          { label: "Refresh", onPress: () => void reload() },
          { label: "Sign out", onPress: () => void signOut(), destructive: true },
        ],
        mode,
      ),
    [reload, signOut, mode],
  );
  // The options are memoised because the navigator is told them on every
  // render: a fresh object, with fresh callbacks in it, is a new instruction
  // each time and the renders never settle.
  const options = useMemo(
    () => ({
      // The address the session is held open at is the workspace's name until a
      // name exists: it is what the person typed, port and all, and the one fact
      // this app holds about where its records live. A product name in its place
      // would say which app this is, which nobody reading their own list asks.
      title: hostLabel(baseURL) || feedback.copy.kit.workspace,
      headerRight: () => (
        <Button
          placement="header"
          label="Account"
          icon="person"
          onPress={account}
          testID="account"
        />
      ),
    }),
    [account, baseURL, feedback.copy.kit.workspace],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <HomeView
        feedback={feedback}
        entries={entries}
        refreshing={refreshing}
        account={identity?.email}
        onOpen={(e) => router.push(screenPath(e))}
        onRefresh={() => void reload()}
      />
    </>
  );
}
