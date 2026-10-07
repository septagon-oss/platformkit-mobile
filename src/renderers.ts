// A renderer pack is how a module ships a screen the schema cannot derive. It
// is a plain object, keyed "module/entity", passed to <Shell> once; nothing
// registers itself, and a key nobody asks for is a key nothing renders.
import type { ComponentType } from "react";
import type { Entry } from "./core/catalog";
import type { Operations } from "./generated/operations.gen";

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
