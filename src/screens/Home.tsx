// Home is the catalog as rows, with the account in the native header: the
// platform's own menu offers Refresh and Sign out.
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import type { Entry } from "../core/catalog";
import { screenPath } from "../core/derive";
import { useShell } from "../shell";
import { Button } from "../ui/atoms/Button";
import { choose } from "../ui/chooser";
import { Home as HomeView } from "../ui/organisms/Home";
import { useTheme } from "../ui/theme";

interface Props {
  readonly entries: readonly Entry[];
}

export function Home({ entries }: Props) {
  const { refresh, signOut } = useShell();
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
      title: "PlatformKit",
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
    [account],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <HomeView
        entries={entries}
        refreshing={refreshing}
        onOpen={(e) => router.push(screenPath(e))}
        onRefresh={() => void reload()}
      />
    </>
  );
}
