// A renderer pack is one typed declaration: the key it is registered under, the read
// that answers that key, and the screens that draw it. `definePack` is the only place
// the key is written, so a misspelled key, an operation belonging to another key and a
// screen drawing a field the read does not answer are all compile errors rather than a
// screen that quietly falls back to the generated one on a device.
//
// What the declaration supplies to a screen is what a screen used to fetch for itself:
// the read (`useOperation`, with the structured verdict on `ReadState`), the entry's own
// commands, and `present`, which reads a field the way this entry's resolved policy says
// it reads. A pack that reached those doors by hand wrote the same rules a generated
// screen already writes; the declaration writes them once.
//
// What it deliberately leaves out: navigation, the header and the media surfaces stay
// the screen's and the composition root's, a form or command screen reaches the published
// form and command doors itself, and a pack that reads a projection rather than a
// documented operation stays a plain `Renderers` record — the record is the escape hatch
// that keeps a product's special case from bending the typed path.
import type { ComponentType } from "react";
import { createElement } from "react";
import { rowCommands } from "./core/command";
import type { Command } from "./core/catalog";
import { presentFor, type Feedback, type Present } from "./core/present";
import type { EntryKey, OperationFor } from "./generated/entries.gen";
import { useCommandRun } from "./screens/useCommand";
import { useFeedback } from "./screens/useFeedback";
import { useOperation } from "./screens/useOperation";
import type { OperationData, OperationInput, ReadState, Renderer, ScreenProps } from "./renderers";

/** Pack is what a declaration puts in the record passed to `<Shell>`: its key, once, and the screens under it. */
export type Pack<K extends EntryKey> = Readonly<{ [P in K]: Renderer }>;

/** PackProps are the props a declared screen is written against: what the dispatcher passes, plus this entry's words. */
export interface PackProps extends ScreenProps {
  /** present reads one field of this entry as this entry's resolved policy reads it. */
  readonly present: Present;
  readonly feedback: Feedback;
}

/** ReadProps adds the row the declared read answered and the commands the entry offers for it. */
export interface ReadProps<d> extends PackProps {
  readonly read: ReadState<d>;
  readonly actions: {
    readonly commands: readonly Command[];
    readonly run: (command: Command) => void;
    readonly busy: string;
  };
}

/**
 * PackDeclaration is the one statement a pack makes. `read` names the operation every
 * read-shaped screen of this pack draws, and `input` says what the screen asks it about:
 * required, because an operation may need a query or a body beside the id, and a default
 * that sent only the id would ask a confident wrong question of those operations. An
 * `input` of undefined asks for nothing, which is how a screen with no row yet renders
 * without a request.
 */
export interface PackDeclaration<K extends EntryKey, R extends OperationFor<K>> {
  readonly key: K;
  readonly read: R;
  readonly input: (props: ScreenProps) => OperationInput<R> | undefined;
  readonly deck?: ComponentType<ReadProps<OperationData<R>>>;
  readonly list?: ComponentType<ReadProps<OperationData<R>>>;
  readonly detail?: ComponentType<ReadProps<OperationData<R>>>;
  readonly form?: ComponentType<PackProps>;
  readonly command?: ComponentType<PackProps>;
}

/** readScreen supplies the declared read, this entry's words and its commands to one screen. */
function readScreen<R extends OperationFor<EntryKey>>(
  read: R,
  input: (props: ScreenProps) => OperationInput<R> | undefined,
  screen: ComponentType<ReadProps<OperationData<R>>>,
): ComponentType<ScreenProps> {
  return function DeclaredRead(props: ScreenProps) {
    const feedback = useFeedback();
    const state = useOperation(read, input(props));
    const running = useCommandRun(props.entry, props.id);
    return createElement(screen, {
      ...props,
      feedback,
      present: presentFor(props.entry, feedback),
      read: state,
      actions: { commands: rowCommands(props.entry), ...running },
    });
  };
}

/** wordedScreen supplies this entry's words to a screen that draws no read: a form or a command sheet. */
function wordedScreen(screen: ComponentType<PackProps>): ComponentType<ScreenProps> {
  return function DeclaredWords(props: ScreenProps) {
    const feedback = useFeedback();
    return createElement(screen, {
      ...props,
      feedback,
      present: presentFor(props.entry, feedback),
    });
  };
}

/**
 * only keeps the kinds a declaration supplied. A kind it leaves out carries no key at
 * all, so `pack[kind]` answers nothing and the dispatcher draws the generated screen
 * for it rather than an empty component of this pack's.
 */
const only = (kinds: Record<keyof Renderer, ComponentType<ScreenProps> | undefined>): Renderer =>
  Object.freeze(
    Object.fromEntries(Object.entries(kinds).filter(([, screen]) => screen !== undefined)),
  ) as Renderer;

/**
 * definePack checks a declaration against the pinned document and returns the one-key
 * pack record to spread into the `renderers` passed to `<Shell>`. A key the document
 * answers no read for, and an operation that answers another key, fail to compile; so
 * does a screen that draws a member the declared body does not carry, because its props
 * are that body's. The returned record is a `Renderers` fragment: the dispatcher, the
 * shell's prop and a plain record of the same key all keep working unchanged.
 */
export function definePack<K extends EntryKey, R extends OperationFor<K>>(
  declaration: PackDeclaration<K, R>,
): Pack<K> {
  const reads = (screen?: ComponentType<ReadProps<OperationData<R>>>) =>
    screen === undefined ? undefined : readScreen(declaration.read, declaration.input, screen);
  const words = (screen?: ComponentType<PackProps>) =>
    screen === undefined ? undefined : wordedScreen(screen);
  const renderer = only({
    deck: reads(declaration.deck),
    list: reads(declaration.list),
    detail: reads(declaration.detail),
    form: words(declaration.form),
    command: words(declaration.command),
  });
  return { [declaration.key]: renderer } as Pack<K>;
}
