// A specimen of a media slot has a name — "The print room in morning light" — and a
// slot that has no picture of its own paints one. Painting it as circles and bars
// under a sentence that promises a room asks a person to do the drawing, so each
// specimen names a scene and this file holds that scene's geometry: the same mark
// vocabulary the kit's derived posters use (src/core/media.ts PosterMark), set by
// hand as the places the copy names. Fractions of the slot's width and height, every
// mark inside the frame, one accent mark so the kit's own colour is in the picture.
import type { PosterMark } from "./media";

export interface Scene {
  readonly name: string;
  readonly marks: readonly PosterMark[];
}

const scenes: readonly Scene[] = [
  {
    // Morning light through a multi-pane window, the printing press with its wheel
    // beside it, and the sheets waiting on the table under the sill.
    name: "print-room",
    marks: [
      // The wall the window is cut into, and the light on the floor below it.
      { id: "wall", tone: "sheet", shape: "band", left: 0, top: 0, width: 1, height: 0.62 },
      { id: "light", tone: "sheet", shape: "band", left: 0.04, top: 0.78, width: 0.42, height: 0.16 },
      // The window: an opening with its own glow, two bars and a sill.
      { id: "glow", tone: "accent", shape: "band", left: 0.1, top: 0.08, width: 0.3, height: 0.42 },
      { id: "window", tone: "ink", shape: "frame", left: 0.09, top: 0.07, width: 0.32, height: 0.44 },
      { id: "bar", tone: "ink", shape: "band", left: 0.235, top: 0.07, width: 0.03, height: 0.44 },
      { id: "transom", tone: "ink", shape: "band", left: 0.09, top: 0.27, width: 0.32, height: 0.03 },
      { id: "sill", tone: "ink", shape: "band", left: 0.06, top: 0.51, width: 0.38, height: 0.035 },
      // The press: its wheel above the bed, the bed on two legs.
      { id: "wheel", tone: "ink", shape: "disc", left: 0.64, top: 0.12, width: 0.18 },
      { id: "frame", tone: "ink", shape: "frame", left: 0.56, top: 0.06, width: 0.36, height: 0.34 },
      { id: "bed", tone: "ink", shape: "band", left: 0.44, top: 0.56, width: 0.5, height: 0.045 },
      { id: "leg-left", tone: "ink", shape: "band", left: 0.47, top: 0.605, width: 0.04, height: 0.24 },
      { id: "leg-right", tone: "ink", shape: "band", left: 0.87, top: 0.605, width: 0.04, height: 0.24 },
      // The sheets, stacked and drying.
      { id: "sheet-one", tone: "sheet", shape: "band", left: 0.5, top: 0.5, width: 0.17, height: 0.05 },
      { id: "sheet-two", tone: "sheet", shape: "band", left: 0.52, top: 0.45, width: 0.14, height: 0.04 },
      { id: "rack", tone: "ink", shape: "frame", left: 0.06, top: 0.68, width: 0.26, height: 0.26 },
    ],
  },
  {
    // The courtyard seen from the upper landing: the balustrade across the front,
    // the arcade along the far side, a tree and the steps down to the paving.
    name: "courtyard",
    marks: [
      // The far elevation, its arcade and the windows above it.
      { id: "facade", tone: "sheet", shape: "band", left: 0, top: 0, width: 1, height: 0.52 },
      { id: "lintel", tone: "ink", shape: "band", left: 0, top: 0.12, width: 1, height: 0.04 },
      { id: "pier-one", tone: "ink", shape: "band", left: 0.06, top: 0.16, width: 0.06, height: 0.38 },
      { id: "pier-two", tone: "ink", shape: "band", left: 0.44, top: 0.16, width: 0.06, height: 0.38 },
      { id: "pier-three", tone: "ink", shape: "band", left: 0.82, top: 0.16, width: 0.06, height: 0.38 },
      { id: "window-one", tone: "ink", shape: "frame", left: 0.18, top: 0.02, width: 0.14, height: 0.08 },
      { id: "window-two", tone: "ink", shape: "frame", left: 0.62, top: 0.02, width: 0.14, height: 0.08 },
      // The tree in its planter, the paving, and the steps down to it.
      { id: "crown", tone: "accent", shape: "disc", left: 0.62, top: 0.34, width: 0.16 },
      { id: "trunk", tone: "ink", shape: "band", left: 0.685, top: 0.46, width: 0.03, height: 0.12 },
      { id: "planter", tone: "ink", shape: "band", left: 0.58, top: 0.58, width: 0.24, height: 0.035 },
      { id: "paving", tone: "sheet", shape: "band", left: 0, top: 0.55, width: 1, height: 0.2 },
      { id: "step-one", tone: "ink", shape: "band", left: 0.2, top: 0.6, width: 0.5, height: 0.02 },
      { id: "step-two", tone: "ink", shape: "band", left: 0.24, top: 0.66, width: 0.42, height: 0.02 },
      // The landing's balustrade: a rail, four balusters and the newel post.
      { id: "rail", tone: "ink", shape: "band", left: 0, top: 0.8, width: 1, height: 0.035 },
      { id: "baluster-one", tone: "ink", shape: "band", left: 0.12, top: 0.835, width: 0.03, height: 0.14 },
      { id: "baluster-two", tone: "ink", shape: "band", left: 0.36, top: 0.835, width: 0.03, height: 0.14 },
      { id: "baluster-three", tone: "ink", shape: "band", left: 0.6, top: 0.835, width: 0.03, height: 0.14 },
      { id: "baluster-four", tone: "ink", shape: "band", left: 0.84, top: 0.835, width: 0.03, height: 0.14 },
      { id: "newel", tone: "ink", shape: "disc", left: 0.02, top: 0.75, width: 0.06 },
    ],
  },
];

/** sceneFor is the geometry a named scene is drawn from: the same marks for the same name, wherever it is asked for. */
export const sceneFor = (name: string): Scene | undefined =>
  scenes.find((scene) => scene.name === name);

/** sceneNames is the vocabulary a specimen may name; anything else draws the derived poster. */
export const sceneNames: readonly string[] = scenes.map((scene) => scene.name);
