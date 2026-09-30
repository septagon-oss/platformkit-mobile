import React, { useRef } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ResumableZoom, type ResumableZoomRefType } from "react-native-zoom-toolkit";
import type { ZoomSlotProps } from "../ui/organisms/PhotoViewer";
import { Button } from "../ui/atoms/Button";
import { kitStyles } from "../ui/layout";
import { useStyles } from "../ui/theme";
export function NativeZoom(props: ZoomSlotProps) {
  return <Zoom key={props.id} {...props} />;
}
function Zoom({ children, motion, labels }: ZoomSlotProps) {
  const zoom = useRef<ResumableZoomRefType>(null),
    s = useStyles(kitStyles);
  const change = (factor: number) => {
    const state = zoom.current?.getState();
    if (state)
      zoom.current?.setTransformState(
        {
          translateX: state.translateX,
          translateY: state.translateY,
          scale: Math.min(6, Math.max(1, state.scale * factor)),
        },
        motion === "normal",
      );
  };
  return (
    <GestureHandlerRootView style={s.grow}>
      <ResumableZoom
        ref={zoom}
        maxScale={6}
        decay={false}
        scaleMode="clamp"
        panMode="clamp"
        tapsEnabled={motion === "normal"}
      >
        {children}
      </ResumableZoom>
      <View style={s.row}>
        <Button label={labels.zoomOut} tone="secondary" onPress={() => change(0.5)} />
        <Button label={labels.zoomIn} tone="secondary" onPress={() => change(2)} />
        <Button
          label={labels.reset}
          tone="plain"
          onPress={() => zoom.current?.reset(motion === "normal")}
        />
      </View>
    </GestureHandlerRootView>
  );
}
