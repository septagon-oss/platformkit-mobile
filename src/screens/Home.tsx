// Home is the catalog as rows, with the account in the native header: the
// platform's own menu offers Refresh and Sign out.
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
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
  const reload = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };
  const account = () =>
    choose(
      "Account",
      [
        { label: "Refresh", onPress: () => void reload() },
        { label: "Sign out", onPress: () => void signOut(), destructive: true },
      ],
      mode,
    );
  return (
    <>
      <Stack.Screen
        options={{
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
        }}
      />
      <HomeView
        entries={entries}
        refreshing={refreshing}
        onOpen={(e) => router.push(screenPath(e))}
        onRefresh={() => void reload()}
      />
    </>
  );
}
