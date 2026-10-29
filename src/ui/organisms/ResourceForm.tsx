// ResourceForm is the create and edit sheet as a pure component: one block per
// section the entry declares, one control per derived Control inside it, the
// refusal under the control it is about, the general refusal at the top. Every
// control is named the same way — the word above it, from FormField — so a
// switch and a date row sit in the same column as a text box. Save and Cancel
// live in the native header, which the screen composition sets from the same
// phase this renders.
import React, { useEffect, useRef, useState } from "react";
import { findNodeHandle, type ScrollView, type TextInput } from "react-native";
import { type Feedback, timeText } from "../../core/present";
import {
  timeValue,
  timeWire,
  type Control,
  type FormBlock,
  type StepperModel,
} from "../../core/form";
import { sketchFromText } from "../../core/form";
import {
  figureLine,
  insertLine,
  lined,
  marked,
  NO_CARET,
  type Caret,
  type Draft,
} from "../../core/richtext";
import { ChoiceRow } from "../atoms/ChoiceRow";
import { DateTimeRow } from "../atoms/DateTimeRow";
import { Notice, retry } from "../atoms/Notice";
import { Skeleton } from "../atoms/Skeleton";
import { SwitchRow } from "../atoms/SwitchRow";
import { TextField, type FieldKind } from "../atoms/TextField";
import { FormField } from "../molecules/FormField";
import { RichTextToolbar } from "../molecules/RichTextToolbar";
import { Section } from "../molecules/Section";
import { TagsField } from "../molecules/TagsField";
import { SketchBoard } from "../molecules/SketchBoard";
import { Text } from "../atoms/Text";
import { Stepper } from "./Stepper";
import { Screen } from "../templates/Screen";

/** Phase is what the sheet is doing: loading the row to edit, failed to, editing, saving, or done. */
export type Phase = "loading" | "failed" | "editing" | "saving" | "saved";

export interface Props {
  readonly feedback: Feedback;
  readonly initialDate: Date;
  readonly blocks: readonly FormBlock[];
  readonly held: Readonly<Record<string, string>>;
  readonly errors: Readonly<Record<string, string>>;
  readonly detail: string;
  /**
   * awaiting is the field the sheet is waiting on: the first one it asks for that
   * carries a sentence. The hook decides which field that is; bringing it forward is
   * this component's, because it is the one that holds the boxes.
   */
  readonly awaiting?: string;
  /**
   * refusals counts the refusals this sheet has announced. A second Save on a sheet
   * nobody mended asks for the same field, so `awaiting` carries the same name twice
   * and an effect keyed on it alone would not run: the count is what makes the second
   * refusal a new request for the box.
   */
  readonly refusals?: number;
  readonly phase: Phase;
  /**
   * walk is the sheet stepped: the stepper's model, and the moves it answers to. Present,
   * the organism draws the step the model says the person stands on, inside the rail and
   * above its verbs; absent, it draws the one scroll the entry asks for. Which step is
   * whose, and what it asks, are the core's answer (`core/form/steps`); this only draws it.
   */
  readonly walk?: {
    readonly model: StepperModel;
    readonly onNext: () => void;
    readonly onBack: () => void;
    readonly onGo: (id: string) => void;
    readonly onSkip: () => void;
    readonly onFinish: () => void;
  };
  /**
   * acts is what a command sheet says above its controls: the record it runs on,
   * and what running it does. Each line is drawn only where it has words, and a
   * sheet with nothing to say draws no block at all. A create or edit sheet passes
   * nothing: a form that writes the record is not a command acting on it.
   */
  readonly acts?: { readonly on: string; readonly consequence: string };
  /**
   * onImage asks the surface for a file to put in a rich text body. It is given the field,
   * and the `put` that answers with the file the person chose — the draft stays with this
   * form, which is the one code that edits it. No surface, no control: a form that cannot
   * reach the file module offers no picture to insert.
   */
  readonly onImage?: (
    field: string,
    put: (pick: { readonly name: string; readonly file: string }) => void,
  ) => void;
  readonly onChange: (name: string, value: string) => void;
  readonly onRetry: () => void;
  /**
   * onFieldRefused carries a field's own refusal up to the sheet: a control that
   * will not write what it holds says so here, so the sheet can refuse a save rather
   * than send the value without the word the person is still being asked to fix.
   */
  readonly onFieldRefused?: (name: string, refused: boolean) => void;
}

const kinds: Partial<Record<Control["kind"], FieldKind>> = {
  textarea: "textarea",
  number: "number",
  reference: "mono",
};

export function ResourceForm({
  feedback,
  initialDate,
  blocks,
  held,
  errors,
  detail,
  awaiting = "",
  refusals = 0,
  phase,
  walk,
  acts,
  onChange,
  onImage,
  onRetry,
  onFieldRefused,
}: Props) {
  const busy = phase === "saving" || phase === "saved";
  const kit = feedback.copy.kit;
  // The boxes a refusal can be answered in, by field name. Only a text-like control
  // has one: a choice, a date, a switch and a tag box are pressed, not focused, and a
  // refused one of those is announced where it stands — FormField says `label: error`
  // on iOS and its error line is a polite live region, so nothing about the refusal is
  // unheard while the keyboard goes to the field that can be typed into.
  const boxes = useRef(new Map<string, TextInput>());
  const scroller = useRef<ScrollView>(null);
  const box = (name: string) => (node: TextInput | null) => {
    if (node) boxes.current.set(name, node);
    else boxes.current.delete(name);
  };
  useEffect(() => {
    if (awaiting === "") return;
    const field = boxes.current.get(awaiting);
    if (!field) return;
    field.focus?.();
    // React Native's own call for the one thing a keyboard makes necessary: it measures
    // this box against the keyboard's top, which no distance written here could know.
    const handle = findNodeHandle(field);
    if (handle !== null)
      scroller.current?.scrollResponderScrollNativeHandleToKeyboard?.(handle, 0, true);
  }, [awaiting, refusals]);

  // The word a field's requiredness is said in. It rides the control's own name,
  // so a screen reader hears `Subject, Required` where a sighted person reads the
  // label above the box and, for an optional one, the word Optional.
  const current = (c: Control) => held[c.field.name] ?? c.value;
  // Where the keyboard's caret last stood in each box, as that box reported it: a formatting
  // control writes its marks where the person was typing, and a box that never reported one
  // is edited at its end.
  const [carets, setCarets] = useState<Record<string, Caret>>({});
  // The body each box shows, and where its caret last stood, kept where an answer that
  // arrives later can still read them: a formatting control writes where the person was
  // typing, and a figure whose file list answered a second later belongs among whatever has
  // been typed since it was asked for — a body read from the server has never been typed in
  // and is still the body on the screen. `apply` runs from a press, outside any render, so
  // this is refreshed after the render that committed the box, never during one.
  const drafts = useRef(new Map<string, Draft>());
  useEffect(() => {
    drafts.current = new Map(
      blocks.flatMap((block) =>
        block.controls.map(
          (c) =>
            [c.field.name, { text: current(c), caret: carets[c.field.name] ?? NO_CARET }] as const,
        ),
      ),
    );
  });
  const apply = (name: string, edit: (draft: Draft) => Draft) => {
    const draft = drafts.current.get(name) ?? { text: held[name] ?? "", caret: NO_CARET };
    const next = edit(draft);
    if (next.text === draft.text) return;
    onChange(name, next.text);
    setCarets((at) => ({ ...at, [name]: next.caret }));
  };
  // A figure is a file the server holds: the surface asks where the picture comes from and
  // answers with the file it ended up as, and the line that figure is gets written at the
  // caret by the one code that edits a draft.
  const placeFigure = (name: string, picked: { readonly name: string; readonly file: string }) =>
    apply(name, (draft) => insertLine(draft, figureLine(picked.name, picked.file)));
  const named = (c: Control) => `${c.label}, ${c.required ? kit.required : kit.optional}`;
  // The author's line, then the one sentence the kit owes a person about the control
  // itself: a value greyed out says what changes it, a bare identifier box says that
  // nothing picks the related record out yet. The words are the copy table's, which is
  // why they are drawn here rather than written into the derivation of a control — a
  // sentence in `control` could only ever be English. A field the author left without
  // a hint is left without one; nothing here invents one.
  const help = (c: Control) =>
    [c.help, c.readOnly ? kit.changedByCommand : c.kind === "reference" ? kit.identifierOnly : ""]
      .filter(Boolean)
      .join(" ");
  const field = (c: Control) => {
    const name = c.field.name;
    const value = current(c);
    const off = c.readOnly || busy;
    const drawn = help(c);
    const common = {
      label: c.label,
      required: c.required,
      copy: kit,
      ...(drawn ? { help: drawn } : {}),
      ...(errors[name] ? { error: errors[name] } : {}),
      testID: `field-${name}`,
    };
    switch (c.kind) {
      case "switch":
        return (
          <FormField key={name} {...common}>
            <SwitchRow
              label={named(c)}
              value={value === "true"}
              onValueChange={(on) => onChange(name, on ? "true" : "false")}
              disabled={off}
            />
          </FormField>
        );
      case "select":
        return (
          <FormField key={name} {...common}>
            <ChoiceRow
              copy={feedback.copy.choice}
              label={named(c)}
              value={value}
              options={c.options}
              onChange={(v) => onChange(name, v)}
              disabled={off}
            />
          </FormField>
        );
      case "datetime":
        return (
          <FormField key={name} {...common}>
            <DateTimeRow
              copy={feedback.copy.dateTime}
              initialValue={initialDate}
              testID={`input-${name}`}
              timeZone={feedback.timeZone}
              label={named(c)}
              value={timeValue(value)}
              onChange={(at) => onChange(name, at ? timeWire(at) : "")}
              text={(at) => timeText(at, feedback)}
              disabled={off}
              required={c.required}
            />
          </FormField>
        );
      case "list":
        return (
          <FormField key={name} {...common}>
            <TagsField
              label={c.label}
              announce={named(c)}
              value={value}
              onChange={(v) => onChange(name, v)}
              onRefused={(r) => onFieldRefused?.(name, r)}
              copy={kit}
              disabled={off}
            />
          </FormField>
        );
      case "sketch":
        return (
          <FormField key={name} {...common}>
            <SketchBoard
              value={sketchFromText(value) ?? []}
              editable={!off}
              accessibilityLabel={named(c)}
              undoLabel={kit.undo}
              clearLabel={kit.clear}
              testID={`input-${name}`}
              onChange={(sketch) => {
                onFieldRefused?.(name, false);
                onChange(name, JSON.stringify(sketch));
              }}
              onRefused={() => onFieldRefused?.(name, true)}
            />
          </FormField>
        );
      default: {
        // A rich text body is written with the marks this phone reads back, so the controls
        // are offered over the box — and only over an editable one: a frozen value takes no
        // marks. The Markdown stays visible: this is a text box with instruments above it,
        // not a face that hides what the body is made of.
        const rich = c.rich === true && !off;
        return (
          <FormField key={name} {...common}>
            {rich ? (
              <RichTextToolbar
                copy={kit}
                disabled={off}
                testID={`toolbar-${name}`}
                actions={{
                  onBold: () => apply(name, (draft) => marked(draft, "**", "**")),
                  onItalic: () => apply(name, (draft) => marked(draft, "_", "_")),
                  onHeading: () => apply(name, (draft) => lined(draft, "## ")),
                  onList: () => apply(name, (draft) => lined(draft, "- ")),
                  ...(onImage === undefined
                    ? {}
                    : {
                        onImage: () => onImage(name, (picked) => placeFigure(name, picked)),
                      }),
                }}
              />
            ) : null}
            <TextField
              ref={box(name)}
              kind={kinds[c.kind] ?? "text"}
              value={value}
              onChangeText={(v) => onChange(name, v)}
              {...(rich
                ? {
                    onSelectionChange: (event: { nativeEvent: { selection: Caret } }) =>
                      setCarets((at) => ({ ...at, [name]: event.nativeEvent.selection })),
                  }
                : {})}
              disabled={off}
              invalid={!!errors[name]}
              accessibilityLabel={named(c)}
              testID={`input-${name}`}
            />
          </FormField>
        );
      }
    }
  };
  return (
    <Screen form testID="resource-form" scrollViewRef={scroller}>
      {acts && (acts.on !== "" || acts.consequence !== "") ? (
        <Section>
          {acts.on !== "" ? (
            <Text role="title" testID="command-subject">
              {acts.on}
            </Text>
          ) : null}
          {acts.consequence !== "" ? (
            <Text role="body" tone="muted" testID="command-consequence">
              {acts.consequence}
            </Text>
          ) : null}
        </Section>
      ) : null}
      {detail ? (
        <Notice
          announcement="urgent"
          text={detail}
          {...(phase === "failed" ? { action: retry(feedback, onRetry) } : {})}
          testID="form-detail"
        />
      ) : null}
      {phase === "loading" ? (
        <Section>
          <Skeleton label={feedback.loadingLabel} motion={feedback.motion} lines={5} />
        </Section>
      ) : phase === "failed" ? null : walk === undefined ? (
        blocks.map((block) => (
          <Section key={block.key || "overview"} {...(block.label ? { title: block.label } : {})}>
            {block.controls.map(field)}
          </Section>
        ))
      ) : (
        (() => {
          // One block of the walk is drawn: the step the model says the person stands
          // on, or the first one when the walk has not been told otherwise. The refusal
          // above, the boxes below and the focus effect between them are the same code
          // a flat sheet runs, because a stepped sheet is the same sheet with a position.
          const step = blocks.find((b) => b.key === walk.model.currentId) ?? blocks[0];
          return (
            <Stepper
              model={walk.model}
              onNext={walk.onNext}
              onBack={walk.onBack}
              onGo={walk.onGo}
              onSkip={walk.onSkip}
              onFinish={walk.onFinish}
            >
              {step === undefined ? null : (
                <Section key={step.key} {...(step.label ? { title: step.label } : {})}>
                  {step.controls.map(field)}
                </Section>
              )}
            </Stepper>
          );
        })()
      )}
    </Screen>
  );
}
