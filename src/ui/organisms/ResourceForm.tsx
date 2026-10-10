// ResourceForm is the create and edit sheet as a pure component: one block per
// section the entry declares, one control per derived Control inside it, the
// refusal under the control it is about, the general refusal at the top. Every
// control is named the same way — the word above it, from FormField — so a
// switch and a date row sit in the same column as a text box. Save and Cancel
// live in the native header, which the screen composition sets from the same
// phase this renders.
import React from "react";
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
  phase,
  onChange,
  onRetry,
  onFieldRefused,
}: Props) {
  const busy = phase === "saving" || phase === "saved";
  const kit = feedback.copy.kit;
  // The word a field's requiredness is said in. It rides the control's own name,
  // so a screen reader hears `Subject, Required` where a sighted person reads the
  // label above the box and, for an optional one, the word Optional.
  const current = (c: Control) => held[c.field.name] ?? c.value;
  const named = (c: Control) => `${c.label}, ${c.required ? kit.required : kit.optional}`;
  const field = (c: Control) => {
    const name = c.field.name;
    const value = current(c);
    const off = c.readOnly || busy;
    const common = {
      label: c.label,
      required: c.required,
      copy: kit,
      ...(c.help ? { help: c.help } : {}),
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
    <Screen form testID="resource-form">
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
