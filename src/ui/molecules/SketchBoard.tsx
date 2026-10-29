import React, { useEffect, useRef, useState } from "react";
import { PanResponder, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import {
  appendSketchPoint,
  beginSketch,
  sketchPoint,
  undoSketch,
  type Sketch,
  type SketchPoint,
} from "../../core/form";
import { Button } from "../atoms/Button";
import { useTheme } from "../theme";

interface ActiveStroke {
  readonly startedAt: number;
  readonly sketch: Sketch;
}

interface BoardSize {
  readonly width: number;
  readonly height: number;
}

function useSketchInput(
  editable: boolean,
  size: BoardSize,
  draft: React.MutableRefObject<Sketch>,
  active: React.MutableRefObject<ActiveStroke | undefined>,
  setActiveDrawing: React.Dispatch<React.SetStateAction<boolean>>,
  setDraft: React.Dispatch<React.SetStateAction<Sketch>>,
  onChange?: (sketch: Sketch) => void,
  onRefused?: () => void,
) {
  const mapped = (event: GestureResponderEvent, startedAt: number): SketchPoint | undefined =>
    sketchPoint(
      event.nativeEvent.locationX,
      event.nativeEvent.locationY,
      size.width,
      size.height,
      Math.max(0, event.nativeEvent.timestamp - startedAt),
    );
  const start = (event: GestureResponderEvent) => {
    if (!editable) return;
    const startedAt = event.nativeEvent.timestamp;
    const point = mapped(event, startedAt);
    const next = point && beginSketch(draft.current, point);
    if (!next) return onRefused?.();
    active.current = { startedAt, sketch: next };
    setActiveDrawing(true);
    draft.current = next;
    setDraft(next);
  };
  const move = (event: GestureResponderEvent) => {
    const stroke = active.current;
    if (!stroke) return;
    const point = mapped(event, stroke.startedAt);
    const next = point && appendSketchPoint(stroke.sketch, point);
    if (!next) return onRefused?.();
    active.current = { ...stroke, sketch: next };
    draft.current = next;
    setDraft(next);
  };
  const finish = () => {
    const stroke = active.current;
    if (!stroke) return;
    active.current = undefined;
    setActiveDrawing(false);
    draft.current = stroke.sketch;
    setDraft(stroke.sketch);
    onChange?.(stroke.sketch);
  };
  return PanResponder.create({
    onStartShouldSetPanResponder: () => editable,
    onMoveShouldSetPanResponder: () => editable,
    onPanResponderGrant: start,
    onPanResponderMove: move,
    onPanResponderRelease: finish,
    onPanResponderTerminate: finish,
  });
}

export interface SketchBoardProps {
  readonly value: Sketch;
  readonly editable: boolean;
  readonly accessibilityLabel: string;
  readonly undoLabel: string;
  readonly clearLabel: string;
  readonly height?: number;
  readonly testID?: string;
  readonly onChange?: (sketch: Sketch) => void;
  readonly onRefused?: () => void;
}

/** SketchBoard draws normalized strokes and adapts responder input into the shared value model. */
export function SketchBoard({
  value,
  editable,
  accessibilityLabel,
  undoLabel,
  clearLabel,
  height,
  testID,
  onChange,
  onRefused,
}: SketchBoardProps) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<Sketch>(value);
  const [activeDrawing, setActiveDrawing] = useState(false);
  const draftRef = useRef<Sketch>(value);
  const active = useRef<ActiveStroke | undefined>(undefined);
  const themeHeight = height ?? theme.extent.sketch;

  useEffect(() => {
    if (active.current) return;
    draftRef.current = value;
    setDraft(value);
  }, [value]);

  const pan = useSketchInput(
    editable,
    size,
    draftRef,
    active,
    setActiveDrawing,
    setDraft,
    onChange,
    onRefused,
  );

  const undo = () => {
    if (!editable || active.current || draftRef.current.length === 0) return;
    const next = undoSketch(draftRef.current);
    draftRef.current = next;
    setDraft(next);
    onChange?.(next);
  };

  const clear = () => {
    if (!editable || draftRef.current.length === 0) return;
    active.current = undefined;
    setActiveDrawing(false);
    draftRef.current = [];
    setDraft([]);
    onChange?.([]);
  };

  return (
    <View>
      <View
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityActions={editable ? [{ name: "increment", label: accessibilityLabel }] : []}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment") {
            const next = beginSketch(draftRef.current, [500, 500, 0]);
            if (next) {
              draftRef.current = next;
              setDraft(next);
              onChange?.(next);
            } else onRefused?.();
          }
        }}
        onLayout={(event) => setSize(event.nativeEvent.layout)}
        style={{ height: themeHeight }}
        testID={testID}
      >
        <Svg width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet">
          {draft.map((stroke, index) => (
            <Stroke
              key={index}
              points={stroke}
              color={theme.color.textPrimary}
              width={theme.extent.chartStroke * 1000}
            />
          ))}
        </Svg>
      </View>
      {editable ? (
        <SketchActions
          undoLabel={undoLabel}
          clearLabel={clearLabel}
          undo={undo}
          clear={clear}
          hasStrokes={draft.length > 0}
          active={activeDrawing}
          {...(testID ? { testID } : {})}
        />
      ) : null}
    </View>
  );
}

function SketchActions({
  undoLabel,
  clearLabel,
  undo,
  clear,
  hasStrokes,
  active,
  testID,
}: {
  readonly undoLabel: string;
  readonly clearLabel: string;
  readonly undo: () => void;
  readonly clear: () => void;
  readonly hasStrokes: boolean;
  readonly active: boolean;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: theme.space.sm }}>
      <Button
        label={undoLabel}
        onPress={undo}
        disabled={!hasStrokes || active}
        tone="secondary"
        {...(testID ? { testID: `${testID}-undo` } : {})}
      />
      <Button
        label={clearLabel}
        onPress={clear}
        disabled={!hasStrokes}
        tone="secondary"
        {...(testID ? { testID: `${testID}-clear` } : {})}
      />
    </View>
  );
}

function Stroke({
  points,
  color,
  width,
}: {
  readonly points: readonly SketchPoint[];
  readonly color: string;
  readonly width: number;
}) {
  if (points.length === 1) {
    return <Circle cx={points[0]![0]} cy={points[0]![1]} r={width / 2} fill={color} />;
  }
  return (
    <Polyline
      points={points.map(([x, y]) => `${x},${y}`).join(" ")}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
