// A renderer pack is how a module ships a screen the schema cannot derive. It
// is a plain object, keyed "module/entity", passed to <Shell> once; nothing
// registers itself, and a key nobody asks for is a key nothing renders.
import type { ComponentType } from "react";
import type { Entry } from "./core/catalog";
import type { Operations } from "./generated/operations.gen";
import type { CoverMotionProps } from "./ui/organisms/RecordCover";
import type { ZoomSlotProps } from "./ui/organisms/PhotoViewer";

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

/**
 * MediaRenderers is the native media a product supplies once to `<Shell>`: the gesture surface
 * a picture opens into, and the motion a record's cover collapses with. Both name a surface a
 * screen may not import itself — react-native-reanimated, and zoom-toolkit through it, cannot
 * be evaluated in the environment every screen is tested in — so they are declared here and
 * arrived at by composition. A product that supplies neither gets the still record: the photo
 * holds still, the picture opens at the page's own size, and the buttons page between them.
 */
export interface MediaRenderers {
  readonly zoom?: ComponentType<ZoomSlotProps>;
  readonly coverMotion?: ComponentType<CoverMotionProps>;
}

export const defaultRenderers: Renderers = {};

/**
 * OperationName is every operation the pinned document has. A pack names one to
 * read typed data; a name the document lacks is a compile error, so the pin, not
 * a screen, is what decides what a screen may ask for.
 */
export type OperationName = keyof Operations;

/** OperationInput is what that operation takes: its generated path, query and body. */
export type OperationInput<K extends OperationName> = Parameters<Operations[K]>[0];

/**
 * OperationData is what its 2xx body is. Every method of `api.operations` runs
 * its own generated validator on the way out (src/effects/api.ts), so a body
 * outside this type is a refusal, never a row with a missing field.
 */
export type OperationData<K extends OperationName> = Awaited<ReturnType<Operations[K]>>["data"];

/** ReadState is one generated read: nothing asked, something asked, or a refusal. */
export interface ReadState<d> {
  /** requested says a read is under way; false with no data means the screen asked for nothing. */
  readonly requested: boolean;
  readonly data: d | undefined;
  /** error is the sentence to put on screen, the server's own or this read's; "" when none. */
  readonly error: string;
  readonly reload: () => void;
}
