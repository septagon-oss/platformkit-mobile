import React, { useState } from "react";
import type { Feedback } from "../../core/present";
import type { Sketch } from "../../core/form";
import { FormField } from "../molecules/FormField";
import { SketchBoard } from "../molecules/SketchBoard";
import { Value } from "../molecules/Value";

/** SketchShowcase presents editable and stored values in the component gallery. */
export function SketchShowcase({ feedback }: { readonly feedback: Feedback }) {
  const [sketch, setSketch] = useState<Sketch>([
    [
      [120, 700, 0],
      [420, 340, 80],
      [820, 460, 160],
    ],
  ]);
  return (
    <>
      <FormField label="Drawing">
        <SketchBoard
          value={sketch}
          editable
          accessibilityLabel="Drawing"
          undoLabel={feedback.copy.kit.undo}
          clearLabel={feedback.copy.kit.clear}
          testID="gallery-sketch"
          onChange={setSketch}
        />
      </FormField>
      <Value presentation={feedback} field={{ name: "drawing", type: "sketch" }} value={sketch} />
    </>
  );
}
