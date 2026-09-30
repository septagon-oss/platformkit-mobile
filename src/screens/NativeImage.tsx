import React, { useLayoutEffect, useRef } from "react";
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
  const identity = `${resource.scope}/${resource.id}/${resource.version}/${resource.uri}`,
    current = useRef<string | undefined>(identity);
  useLayoutEffect(() => {
    current.current = identity;
    return () => {
      if (current.current === identity) current.current = undefined;
    };
  }, [identity]);
  const report = (state: "loading" | "ready" | "error") => {
    if (current.current === identity && resource.id === model.id) onState(model.id, state);
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
