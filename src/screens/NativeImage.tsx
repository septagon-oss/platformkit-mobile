import { clearImageMemory } from "../effects/native-images";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Image } from "expo-image";
import { parse, SvgAst } from "react-native-svg";
import type { ImageSlotProps } from "../core/media";
import type { PictureResource } from "../effects/media";
export function NativeImage({
  model,
  resource,
  onState,
}: {
  readonly model: ImageSlotProps;
  readonly resource: PictureResource;
  readonly onState: (id: string, state: "loading" | "ready" | "error") => void;
}) {
  const identity = JSON.stringify([
      resource.scope,
      resource.id,
      resource.version,
      resource.kind === "svg" ? "svg" : resource.uri,
      model.id,
      model.instance,
    ]),
    request = useMemo(() => ({ identity }), [identity]),
    current = useRef<typeof request | undefined>(request);
  const failed = useRef<typeof request | undefined>(undefined);
  const callback = useRef(onState);
  useLayoutEffect(() => {
    callback.current = onState;
  });
  useLayoutEffect(() => {
    current.current = request;
    return () => {
      if (current.current === request) current.current = undefined;
    };
  }, [request]);
  const report = useCallback(
    (state: "loading" | "ready" | "error") => {
      if (current.current !== request || resource.id !== model.id) return;
      if (resource.kind === "svg") {
        if (failed.current === request) return;
        if (state === "error") failed.current = request;
      }
      callback.current(model.id, state);
    },
    [request, resource.id, resource.kind, model.id],
  );
  useLayoutEffect(() => {
    if (resource.kind === "svg") report("loading");
  }, [resource.kind, report]);
  if (resource.id !== model.id) return null;
  if (resource.kind === "svg")
    return (
      <PictureBoundary key={identity} onError={() => report("error")}>
        <SvgPicture xml={resource.xml} model={model} report={report} />
      </PictureBoundary>
    );
  return (
    <Image
      key={identity}
      source={{
        uri: resource.uri,
        ...(resource.cacheKey ? { cacheKey: resource.cacheKey } : {}),
        ...(resource.headers ? { headers: { ...resource.headers } } : {}),
      }}
      recyclingKey={identity}
      cachePolicy={resource.cachePolicy ?? "none"}
      transition={0}
      contentFit={model.fit}
      accessible={!model.decorative}
      accessibilityLabel={model.description}
      style={{ width: "100%", height: "100%" }}
      onLoadStart={() => report("loading")}
      onLoad={() => report("ready")}
      onError={() => report("error")}
    />
  );
}

/** PictureBoundary withdraws an SVG whose native tree cannot render. */
class PictureBoundary extends React.Component<
  React.PropsWithChildren<{ readonly onError: () => void }>,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <PictureFailure onError={this.props.onError} />
    ) : (
      this.props.children
    );
  }
}

/** PictureFailure reports after layout so a replacement's guards and callback own the refusal. */
function PictureFailure({ onError }: { readonly onError: () => void }) {
  useEffect(onError, [onError]);
  return null;
}

function SvgPicture({
  xml,
  model,
  report,
}: {
  readonly xml: string;
  readonly model: ImageSlotProps;
  readonly report: (state: "ready" | "error") => void;
}) {
  const ast = useMemo(() => {
    try {
      const parsed = parse(xml);
      return parsed?.tag === "svg" ? parsed : null;
    } catch {
      return null;
    }
  }, [xml]);
  useEffect(() => {
    report(ast ? "ready" : "error");
  }, [ast, report]);
  return ast ? (
    <SvgAst
      ast={ast}
      override={{
        width: "100%",
        height: "100%",
        preserveAspectRatio: model.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet",
        accessible: !model.decorative,
        accessibilityLabel: model.description,
      }}
    />
  ) : null;
}

export const clearNativeImageMemory = () => clearImageMemory(() => Image.clearMemoryCache());
