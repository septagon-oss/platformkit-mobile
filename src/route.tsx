// route.tsx is what every resource route does: read the two names from the
// path, find the entry in the catalog, pick the renderer pack's screen or the
// generated one, and send an anonymous visitor to sign in. It is the whole of
// the composition a route file would otherwise repeat four times.
import { Redirect, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback } from "react";
import { View } from "react-native";
import { packKey, shellReady, type Entry } from "./core/catalog";
import { humanize, noun } from "./core/derive";
import { address } from "./core/reentry";
import type { Renderer } from "./renderers";
import { ResourceCommand } from "./screens/ResourceCommand";
import { ResourceDetail } from "./screens/ResourceDetail";
import { ResourceForm } from "./screens/ResourceForm";
import { ResourceList } from "./screens/ResourceList";
import { Singleton } from "./screens/Singleton";
import { useFeedback } from "./screens/useFeedback";
import { useShell } from "./shell";
import { Button } from "./ui/atoms/Button";
import { Notice as NoticeView, retry } from "./ui/atoms/Notice";
import { Spinner } from "./ui/atoms/Spinner";
import { Text } from "./ui/atoms/Text";
import { kitStyles } from "./ui/layout";
import { Screen } from "./ui/templates/Screen";
import { useStyles } from "./ui/theme";

const generated: Required<Renderer> = {
  list: ResourceList,
  detail: ResourceDetail,
  form: ResourceForm,
  command: ResourceCommand,
};

interface Props {
  readonly kind: keyof Renderer;
  /** withID says the screen is about one row; the id comes from the path. */
  readonly withID?: boolean;
  /** withVerb says the screen is about one command; the verb comes from the path. */
  readonly withVerb?: boolean;
}

export function ResourceRoute({ kind, withID = false, withVerb = false }: Props) {
  const { state, renderers, entry, saw } = useShell();
  const params = useLocalSearchParams<{
    module: string;
    entity: string;
    id?: string;
    verb?: string;
  }>();
  const module = params.module ?? "";
  const entity = params.entity ?? "";
  const id = withID ? params.id : undefined;
  const verb = withVerb ? params.verb : undefined;
  // Where the person is, said as this screen draws. The shell keeps it so a
  // session the server refuses can bring them back here, and says so on focus
  // rather than on mount: returning to a sheet that never unmounted is exactly
  // the case a mount effect misses. The entry is looked up inside the effect
  // because it lives in a catalogue this route may not have yet — an address
  // with no entry in it is not a place anybody is.
  useFocusEffect(
    useCallback(() => {
      const here = entry(module, entity);
      if (here) saw(address(kind, here, id, verb));
    }, [entry, kind, module, entity, id, verb, saw]),
  );

  if (state.phase === "anonymous" || state.phase === "signing-in")
    return <Redirect href="/sign-in" />;
  if (state.phase === "booting" || state.phase === "loading") return <Waiting />;
  if (state.phase === "failed")
    // The one sentence this build owns about a catalogue it could not open lives in
    // `Notice` below: the shell's own words when it has them, nothing restated here.
    return <Notice text={state.error} />;

  // A resource route without a resource in its path is not a screen. It
  // happens when the app is relaunched into a remembered route, and saying
  // "undefined/undefined is not in this installation" would be neither true
  // nor useful.
  if (!module || !entity) return <Redirect href="/" />;

  const found = entry(module, entity);
  if (!found) return <Notice text={`${module}/${entity} is not in this installation.`} />;

  // A tenant has one of a singleton, at the entry's own path, so its list
  // route is the record itself: a list of one row with a New button on it
  // would be three doors the API does not have.
  //
  // The pack is looked up by the key the *entry* names (its own "module/entity"
  // unless it asks for another pack's screen), and it is drawn only when this
  // build's shell can draw it. An entry that wants a newer shell, or a pack this
  // binary does not carry, gets the generated screens: which pack draws a row
  // changes nothing about what may be read or written — every address, door and
  // permission below it still comes from the entry and the server's answer.
  const pack = renderers[packKey(found)];
  const asked = pack?.[kind];
  const behind = asked !== undefined && !shellReady(found);
  const Screen =
    asked === undefined || behind
      ? kind === "list" && found.singleton
        ? Singleton
        : generated[kind]
      : asked;
  return (
    <>
      <Screen
        entry={found}
        {...(id !== undefined ? { id } : {})}
        {...(verb !== undefined ? { verb } : {})}
      />
      {behind ? <ShellUpdate /> : null}
    </>
  );
}

/**
 * ShellUpdate is the one thing this build says about a screen it cannot draw.
 * It is a line in the page's foot, not a Notice: a Notice announces a refusal
 * and offers to put it right, and there is nothing here to retry — the record
 * is being drawn, by the generic screens, until the app is updated.
 */
function ShellUpdate() {
  const feedback = useFeedback();
  const s = useStyles(kitStyles);
  return (
    <View style={s.footer}>
      <Text role="caption" tone="muted" testID="shell-update">
        {feedback.copy.kit.shellUpdate}
      </Text>
    </View>
  );
}

/**
 * sheet and commandSheet are what a modal route's header is, named in the
 * layout so it exists before the screen mounts: a modal is presented with the
 * header it has at that moment, and a title set a frame later leaves the
 * route's own name on screen. Both read the path, which is where the words
 * are; they live here rather than in the layout because spelling a name is a
 * rule, and the composition root holds none.
 *
 * The kind of record a sheet is about is named by `entry`, which is how the shell
 * answers what a module and an entity are: the word the catalogue gave the entry,
 * which is the same word the list's toolbar puts on its New button. An entry that
 * is not there yet — the sheet is titled a moment before the catalogue arrives, and
 * for any address the shell has not read — leaves the wire word from the address,
 * which is what a sheet title has always read. The words *over* that name come from
 * the copy table, so a Portuguese phone reads Portuguese in a header it used to
 * read English in.
 */
export const sheet =
  (
    title: (name: string) => string,
    entry?: (module: string, entity: string) => Entry | undefined,
  ) =>
  (prop: { route: { params?: unknown } }) => {
    const at = (prop.route.params ?? {}) as { entity?: string; module?: string };
    const found = at.module === undefined ? undefined : entry?.(at.module, at.entity ?? "");
    // `noun` is what the list's toolbar puts on its New button, so the sheet a
    // press opens is titled with the word the person just read.
    const name = found === undefined ? (at.entity ?? "") : noun(found).singular;
    return {
      presentation: "modal" as const,
      headerLargeTitleEnabled: false,
      title: title(name),
    };
  };

export const commandSheet = (prop: { route: { params?: unknown } }) => {
  const verb = (prop.route.params as { verb?: string } | undefined)?.verb ?? "";
  return {
    presentation: "modal" as const,
    headerLargeTitleEnabled: false,
    title: humanize(verb),
  };
};

export function Waiting() {
  const feedback = useFeedback();
  return <Spinner label={feedback.loadingLabel} motion={feedback.motion} size="large" fill />;
}

export function Notice({
  text,
  onRetry,
  onSignIn,
}: {
  /** A catalogue this build could not open is the one refusal every screen above the
   * shell can show, so its sentence is owned here: the shell's own words when it has
   * them, the workspace sentence from the phone's own bundle when it has not. No
   * route, screen or app entry restates it — a second spelling is a second rule. */
  readonly text?: string | undefined;
  readonly onRetry?: () => void;
  /** onSignIn is the way out when the saved server is the thing that is wrong. */
  readonly onSignIn?: () => void;
}) {
  const feedback = useFeedback();
  const said = text ?? feedback.copy.failure.loadCatalog;
  return (
    <Screen>
      <NoticeView
        announcement="urgent"
        text={said}
        {...(onRetry ? { action: retry(feedback, onRetry) } : {})}
      />
      {onSignIn ? (
        <Button label="Sign in to another server" tone="secondary" onPress={onSignIn} />
      ) : null}
    </Screen>
  );
}
