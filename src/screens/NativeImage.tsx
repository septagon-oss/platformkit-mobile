import React, { useLayoutEffect, useMemo, useRef } from "react";
import { Image } from "expo-image";
import type { ImageSlotProps } from "../core/derive";
import type { ImageResource } from "../effects/media";
export function NativeImage({
  model,
  resource,
  onState,
}: {
  readonly model: ImageSlotProps;
  readonly resource: ImageResource;
  readonly onState: (id: string, state: "loading" | "ready" | "error") => void;
}) {
  const identity = JSON.stringify([
      resource.scope,
      resource.id,
      resource.version,
      resource.uri,
      model.id,
    ]),
    request = useMemo(() => ({ identity }), [identity]),
    current = useRef<typeof request | undefined>(request);
  useLayoutEffect(() => {
    current.current = request;
    return () => {
      if (current.current === request) current.current = undefined;
    };
  }, [request]);
  const report = (state: "loading" | "ready" | "error") => {
    if (current.current === request && resource.id === model.id) onState(model.id, state);
  };
  if (resource.id !== model.id) return null;
  return (
    <Image
      key={identity}
      source={{
        uri: resource.uri,
        ...(resource.headers ? { headers: { ...resource.headers } } : {}),
      }}
      recyclingKey={identity}
      cachePolicy="none"
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
