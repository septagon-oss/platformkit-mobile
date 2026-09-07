// A renderer pack is how a module ships a screen the schema cannot derive. It
// is a plain object, keyed "module/entity", passed to <Shell> once; nothing
// registers itself, and a key nobody asks for is a key nothing renders.
import type { ComponentType } from "react";
import type { Entry } from "./core/catalog";

export interface ScreenProps {
  readonly entry: Entry;
  readonly id?: string;
  /** verb is which lifecycle command the screen is about, for the command kind. */
  readonly verb?: string;
}

export interface Renderer {
  readonly list?: ComponentType<ScreenProps>;
  readonly detail?: ComponentType<ScreenProps>;
  readonly form?: ComponentType<ScreenProps>;
  readonly command?: ComponentType<ScreenProps>;
}

export type Renderers = Readonly<Record<string, Renderer>>;

export const defaultRenderers: Renderers = {};
