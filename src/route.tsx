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
import { Button } from "./ui/atoms/Button";
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

  // A resource route without a resource in its path is not a screen. It
  // happens when the app is relaunched into a remembered route, and saying
  // "undefined/undefined is not in this installation" would be neither true
  // nor useful.
  const module = params.module ?? "";
  const entity = params.entity ?? "";
  if (!module || !entity) return <Redirect href="/" />;

  const found = entry(module, entity);
  if (!found) return <Notice text={`${module}/${entity} is not in this installation.`} />;

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
  onSignIn,
}: {
  readonly text: string;
  readonly onRetry?: () => void;
  /** onSignIn is the way out when the saved server is the thing that is wrong. */
  readonly onSignIn?: () => void;
}) {
  return (
    <Screen>
      <NoticeView
        text={text}
        {...(onRetry ? { action: { label: "Retry", onPress: onRetry } } : {})}
      />
      {onSignIn ? (
        <Button label="Sign in to another server" tone="secondary" onPress={onSignIn} />
      ) : null}
    </Screen>
  );
}
