import React, { useRef, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { fitContainer, ResumableZoom, type ResumableZoomRefType } from "react-native-zoom-toolkit";
import type { ZoomSlotProps } from "../ui/organisms/PhotoViewer";
import { Button } from "../ui/atoms/Button";
import { kitStyles } from "../ui/layout";
import { useStyles } from "../ui/theme";
export function NativeZoom(props: ZoomSlotProps) {
  return <Zoom key={props.id} {...props} />;
}
function Zoom({ children, aspectRatio, motion, labels }: ZoomSlotProps) {
  const zoom = useRef<ResumableZoomRefType>(null),
    s = useStyles(kitStyles);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const { width } = fitContainer(aspectRatio, frame);
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
  const pan = (x: number, y: number) => {
    const state = zoom.current?.getState(),
      frame = zoom.current?.getVisibleRect();
    if (state && frame)
      zoom.current?.setTransformState(
        {
          scale: state.scale,
          translateX: state.translateX + (x * frame.width * state.scale) / 4,
          translateY: state.translateY + (y * frame.height * state.scale) / 4,
        },
        motion === "normal",
      );
  };
  return (
    <GestureHandlerRootView style={s.grow}>
      <View
        style={s.viewport}
        onLayout={({ nativeEvent: { layout } }) =>
          setFrame((current) =>
            current.width === layout.width && current.height === layout.height
              ? current
              : { width: layout.width, height: layout.height },
          )
        }
      >
        <ResumableZoom
          ref={zoom}
          maxScale={6}
          decay={false}
          scaleMode="clamp"
          panMode="clamp"
          tapsEnabled={motion === "normal"}
        >
          {/* The zoom child is measured intrinsically; percentages need a bounded parent. */}
          <View style={{ width }}>{children}</View>
        </ResumableZoom>
      </View>
      {/* Keep controls reachable without wrapping away the image's height. */}
      <ScrollView
        horizontal
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={[s.row, { flexWrap: "nowrap" }]}
        onFocus={(event) => {
          if (Platform.OS === "web") {
            // Browser focus can leave a partially visible button clipped.
            (event.target as unknown as HTMLElement).scrollIntoView({
              block: "nearest",
              inline: "nearest",
              behavior: "instant",
            });
          }
        }}
      >
        <Button label={labels.panLeft} tone="secondary" onPress={() => pan(1, 0)} />
        <Button label={labels.panRight} tone="secondary" onPress={() => pan(-1, 0)} />
        <Button label={labels.panUp} tone="secondary" onPress={() => pan(0, 1)} />
        <Button label={labels.panDown} tone="secondary" onPress={() => pan(0, -1)} />
        <Button label={labels.zoomOut} tone="secondary" onPress={() => change(0.5)} />
        <Button label={labels.zoomIn} tone="secondary" onPress={() => change(2)} />
        <Button
          label={labels.reset}
          tone="plain"
          onPress={() => zoom.current?.reset(motion === "normal")}
        />
      </ScrollView>
    </GestureHandlerRootView>
  );
}
