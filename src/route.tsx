// route.tsx is what every resource route does: read the two names from the
// path, find the entry in the catalog, pick the renderer pack's screen or the
// generated one, and send an anonymous visitor to sign in. It is the whole of
// the composition a route file would otherwise repeat four times.
import { Redirect, useLocalSearchParams } from "expo-router";
import React from "react";
import { key } from "./core/catalog";
import type { Renderer } from "./renderers";
import { ResourceDetail } from "./screens/ResourceDetail";
import { ResourceForm } from "./screens/ResourceForm";
import { ResourceList } from "./screens/ResourceList";
import { useShell } from "./shell";
import { Notice as NoticeView } from "./ui/atoms/Notice";
import { Spinner } from "./ui/atoms/Spinner";
import { Screen } from "./ui/templates/Screen";

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

  if (state.phase === "anonymous" || state.phase === "signing-in")
    return <Redirect href="/sign-in" />;
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
  return <Spinner size="large" fill />;
}

export function Notice({
  text,
  onRetry,
}: {
  readonly text: string;
  readonly onRetry?: () => void;
}) {
  return (
    <Screen>
      <NoticeView
        text={text}
        {...(onRetry ? { action: { label: "Retry", onPress: onRetry } } : {})}
      />
    </Screen>
  );
}
