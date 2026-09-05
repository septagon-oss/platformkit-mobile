// route.tsx is what every resource route does: read the two names from the
// path, find the entry in the catalog, pick the renderer pack's screen or the
// generated one, and send an anonymous visitor to sign in. It is the whole of
// the composition a route file would otherwise repeat four times.
import { Redirect, useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { key } from "./core/catalog";
import type { Renderer } from "./renderers";
import { ResourceDetail } from "./screens/ResourceDetail";
import { ResourceForm } from "./screens/ResourceForm";
import { ResourceList } from "./screens/ResourceList";
import { color, font, space } from "./screens/theme";
import { useShell } from "./shell";

const generated: Required<Renderer> = {
  list: ResourceList,
  detail: ResourceDetail,
  form: ResourceForm,
};

interface Props {
  readonly kind: keyof Renderer;
  /** withID says the screen is about one row; the id comes from the path. */
  readonly withID?: boolean;
}

export function ResourceRoute({ kind, withID = false }: Props) {
  const { state, renderers, entry } = useShell();
  const params = useLocalSearchParams<{ module: string; entity: string; id?: string }>();

  if (state.phase === "anonymous") return <Redirect href="/sign-in" />;
  if (state.phase === "booting" || state.phase === "loading") return <Waiting />;
  if (state.phase === "failed")
    return <Notice text={state.error ?? "The catalog could not be read."} />;

  const found = entry(params.module ?? "", params.entity ?? "");
  if (!found)
    return <Notice text={`${params.module}/${params.entity} is not in this installation.`} />;

  const Screen = renderers[key(found)]?.[kind] ?? generated[kind];
  const id = withID ? params.id : undefined;
  return <Screen entry={found} {...(id !== undefined ? { id } : {})} />;
}

export function Waiting() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={color.accent} />
    </View>
  );
}

export function Notice({ text }: { readonly text: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.notice}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    backgroundColor: color.canvas,
  },
  notice: { color: color.textMuted, fontSize: font.md, textAlign: "center" },
});
