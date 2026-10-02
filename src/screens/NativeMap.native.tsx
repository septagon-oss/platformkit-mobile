import React, { useLayoutEffect, useMemo, useRef } from "react";
import { Map, Camera, Marker } from "@maplibre/maplibre-react-native";
import type { Props } from "./NativeMap";
import { Button } from "../ui/atoms/Button";
export function NativeMap({ model, resource, onState }: Props) {
  const identity = JSON.stringify([resource.scope, resource.version, resource.styleURL]);
  const request = useMemo(() => ({ identity }), [identity]);
  const current = useRef<typeof request | undefined>(request);
  useLayoutEffect(() => {
    current.current = request;
    return () => {
      if (current.current === request) current.current = undefined;
    };
  }, [request]);
  return (
    <Map
      key={identity}
      mapStyle={resource.styleURL}
      touchRotate={false}
      touchPitch={false}
      onDidFinishLoadingMap={() => {
        if (current.current === request) onState("ready");
      }}
      onDidFailLoadingMap={() => {
        if (current.current === request) onState("error");
      }}
      onRegionDidChange={(event) => {
        if (current.current !== request || !event.nativeEvent.userInteraction) return;
        const { center, zoom } = event.nativeEvent;
        model.onViewport({ longitude: center[0], latitude: center[1], zoom });
      }}
    >
      <Camera
        center={[model.viewport.longitude, model.viewport.latitude]}
        zoom={model.viewport.zoom}
        bearing={0}
        pitch={0}
        duration={0}
      />
      {model.markers.map((marker) => (
        <Marker key={marker.id} id={marker.id} lngLat={[marker.longitude, marker.latitude]}>
          <Button
            label={marker.label}
            tone="secondary"
            selected={marker.selected}
            onPress={() => {
              if (current.current === request) model.onMarker(marker.id);
            }}
          />
        </Marker>
      ))}
    </Map>
  );
}
