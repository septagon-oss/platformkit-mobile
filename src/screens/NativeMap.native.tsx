import React, { useLayoutEffect, useRef } from "react";
import { Map, Camera, Marker } from "@maplibre/maplibre-react-native";
import type { Props } from "./NativeMap";
import { Button } from "../ui/atoms/Button";
export function NativeMap({ model, resource, onState }: Props) {
  const identity = `${resource.scope}/${resource.version}/${resource.styleURL}`;
  const current = useRef<string | undefined>(identity);
  useLayoutEffect(() => {
    current.current = identity;
    return () => {
      if (current.current === identity) current.current = undefined;
    };
  }, [identity]);
  return (
    <Map
      key={identity}
      mapStyle={resource.styleURL}
      touchRotate={false}
      touchPitch={false}
      onDidFinishLoadingMap={() => {
        if (current.current === identity) onState("ready");
      }}
      onDidFailLoadingMap={() => {
        if (current.current === identity) onState("error");
      }}
      onRegionDidChange={(event) => {
        if (current.current !== identity || !event.nativeEvent.userInteraction) return;
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
              if (current.current === identity) model.onMarker(marker.id);
            }}
          />
        </Marker>
      ))}
    </Map>
  );
}
