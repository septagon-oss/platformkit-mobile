// ResourceForm is the create and edit sheet as a pure component: one block per
// section the entry declares, one control per derived Control inside it, the
// refusal under the control it is about, the general refusal at the top. Every
// control is named the same way — the word above it, from FormField — so a
// switch and a date row sit in the same column as a text box. Save and Cancel
// live in the native header, which the screen composition sets from the same
// phase this renders.
import React, { useEffect, useRef } from "react";
import { findNodeHandle, type ScrollView, type TextInput } from "react-native";
import {
  type Feedback,
  timeText,
  timeValue,
  timeWire,
  type Control,
  FormBlock,
} from "../../core/derive";
import { ChoiceRow } from "../atoms/ChoiceRow";
import { DateTimeRow } from "../atoms/DateTimeRow";
import { Notice, retry } from "../atoms/Notice";
import { Skeleton } from "../atoms/Skeleton";
import { SwitchRow } from "../atoms/SwitchRow";
import { TextField, type FieldKind } from "../atoms/TextField";
import { FormField } from "../molecules/FormField";
import { Section } from "../molecules/Section";
import { TagsField } from "../molecules/TagsField";
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
  readonly phase: Phase;
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
  phase,
  onChange,
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
  }, [awaiting]);

  // The word a field's requiredness is said in. It rides the control's own name,
  // so a screen reader hears `Subject, Required` where a sighted person reads the
  // label above the box and, for an optional one, the word Optional.
  const current = (c: Control) => held[c.field.name] ?? c.value;
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
      default:
        return (
          <FormField key={name} {...common}>
            <TextField
              ref={box(name)}
              kind={kinds[c.kind] ?? "text"}
              value={value}
              onChangeText={(v) => onChange(name, v)}
              disabled={off}
              invalid={!!errors[name]}
              accessibilityLabel={named(c)}
              testID={`input-${name}`}
            />
          </FormField>
        );
    }
  };
  return (
    <Screen form testID="resource-form" scrollViewRef={scroller}>
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
      ) : phase === "failed" ? null : (
        blocks.map((block) => (
          <Section key={block.key || "overview"} {...(block.label ? { title: block.label } : {})}>
            {block.controls.map(field)}
          </Section>
        ))
      )}
    </Screen>
  );
}
