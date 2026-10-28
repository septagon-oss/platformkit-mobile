// A renderer pack is how a module ships a screen the schema cannot derive. It
// is a plain object, keyed "module/entity", passed to <Shell> once; nothing
// registers itself, and a key nobody asks for is a key nothing renders.
import type { ComponentType } from "react";
import type { Entry } from "./core/catalog";
import type { FailureVerdict } from "./core/failure";
import type { EntryKey, OperationFor } from "./generated/entries.gen";
import type { Operations } from "./generated/operations.gen";
import type { FinishingProps } from "./ui/organisms/ResourceDetail";
import type { CoverMotionProps } from "./ui/organisms/RecordCover";
import type { ZoomSlotProps } from "./ui/organisms/PhotoViewer";
import type { DeckMotionProps } from "./ui/organisms/ResourceDeck";
import type { RowActionProps } from "./ui/organisms/DataList";

/**
 * ScreenProps is what the route dispatcher hands a screen: the catalogue entry it is
 * about, the record's id, and the verb a command screen is running. A pack screen
 * written with `definePack` (`./pack`) gets these three beside the read, the words and
 * the row's commands it declares a need for; a screen added to a plain `Renderers`
 * record — the deprecated form — is written against this shape alone.
 */
export interface ScreenProps {
  readonly entry: Entry;
  readonly id?: string;
  /** verb is which lifecycle command the screen is about, for the command kind. */
  readonly verb?: string;
}

export interface Renderer {
  readonly deck?: ComponentType<ScreenProps>;
  readonly list?: ComponentType<ScreenProps>;
  readonly detail?: ComponentType<ScreenProps>;
  readonly form?: ComponentType<ScreenProps>;
  readonly command?: ComponentType<ScreenProps>;
}

export type Renderers = Readonly<Record<string, Renderer>>;

/**
 * MediaRenderers is the native media a product supplies once to `<Shell>`: the gesture surface a
 * picture opens into, the motion a record's cover collapses and flies in with, the motion a record
 * makes when it reaches a state its entry calls finished, and the gesture surface a row's command
 * stands open under. Each names a surface a screen may not import itself — react-native-reanimated,
 * react-native-gesture-handler and zoom-toolkit through them cannot be evaluated in the environment
 * every screen is tested in — so they are declared here and arrived at by composition. A product
 * that supplies none of them gets the still product: the photo holds still, the picture opens at the
 * page's own size, the buttons page between them, a record that finishes says so in words and in a
 * felt haptic and draws no ink of its own, and a row's command is offered as an action of the row
 * rather than under a finger.
 */
export interface MediaRenderers {
  readonly deck?: ComponentType<DeckMotionProps>;
  readonly zoom?: ComponentType<ZoomSlotProps>;
  readonly coverMotion?: ComponentType<CoverMotionProps>;
  readonly finishing?: ComponentType<FinishingProps>;
  readonly rowAction?: ComponentType<RowActionProps>;
}

export const defaultRenderers: Renderers = {};

/**
 * OperationName is every operation the pinned document has. A pack names one to
 * read typed data; a name the document lacks is a compile error, so the pin, not
 * a screen, is what decides what a screen may ask for.
 */
export type OperationName = keyof Operations;

/**
 * EntryKey is every `"module/entity"` the pinned document answers a read of, and
 * OperationFor is the reads that answer one. Both come from the same generated
 * inventory the transport's route table comes from (`src/generated/entries.gen.ts`),
 * which is what lets a pack declaration tie its key to its read: a key the document
 * answers nothing for, or an operation that answers another key, is a compile error.
 */
export type { EntryKey, OperationFor };

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
  /**
   * failure is the verdict behind that sentence whenever the read answered one — the
   * kind, what the screen keeps and what the person may do next. A verdict that draws
   * no sentence at all (`outcome` "silent" or "fields") is exactly what `error` cannot
   * say, so it is carried here; undefined when nothing was asked or a body arrived.
   */
  readonly failure?: FailureVerdict | undefined;
  readonly reload: () => void;
}
