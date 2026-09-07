// ResourceForm is the create and edit sheet as a pure component: one control
// per derived Control, the refusal under the control it is about, the general
// refusal at the top. Save and Cancel live in the native header, which the
// screen composition sets from the same phase this renders.
import React from "react";
import { timeText, timeValue, timeWire, type Control } from "../../core/derive";
import { ChoiceRow } from "../atoms/ChoiceRow";
import { DateTimeRow } from "../atoms/DateTimeRow";
import { Notice } from "../atoms/Notice";
import { Skeleton } from "../atoms/Skeleton";
import { SwitchRow } from "../atoms/SwitchRow";
import { TextField, type FieldKind } from "../atoms/TextField";
import { FormField } from "../molecules/FormField";
import { Section } from "../molecules/Section";
import { TagsField } from "../molecules/TagsField";
import { Screen } from "../templates/Screen";

/** Phase is what the sheet is doing: loading the row to edit, failed to, editing, or saving. */
export type Phase = "loading" | "failed" | "editing" | "saving";

export interface Props {
  readonly controls: readonly Control[];
  readonly held: Readonly<Record<string, string>>;
  readonly errors: Readonly<Record<string, string>>;
  readonly detail: string;
  readonly phase: Phase;
  readonly onChange: (name: string, value: string) => void;
  readonly onRetry: () => void;
}

const kinds: Partial<Record<Control["kind"], FieldKind>> = {
  textarea: "textarea",
  number: "number",
  reference: "mono",
};

export function ResourceForm({ controls, held, errors, detail, phase, onChange, onRetry }: Props) {
  const busy = phase === "saving";
  const current = (c: Control) => held[c.field.name] ?? c.value;
  return (
    <Screen form testID="resource-form">
      {detail ? (
        <Notice
          title="That could not be saved"
          text={detail}
          {...(phase === "failed" ? { action: { label: "Retry", onPress: onRetry } } : {})}
          testID="form-detail"
        />
      ) : null}
      {phase === "loading" ? (
        <Section>
          <Skeleton lines={5} />
        </Section>
      ) : phase === "failed" ? null : (
        <Section>
          {controls.map((c) => {
            const name = c.field.name;
            const value = current(c);
            const off = c.readOnly || busy;
            const common = {
              label: c.label,
              required: c.required,
              ...(c.help ? { help: c.help } : {}),
              ...(errors[name] ? { error: errors[name] } : {}),
              testID: `field-${name}`,
            };
            switch (c.kind) {
              case "switch":
                return (
                  <FormField key={name} {...common} bare>
                    <SwitchRow
                      label={c.label}
                      value={value === "true"}
                      onValueChange={(on) => onChange(name, on ? "true" : "false")}
                      disabled={off}
                    />
                  </FormField>
                );
              case "select":
                return (
                  <FormField key={name} {...common} bare>
                    <ChoiceRow
                      label={c.label}
                      value={value}
                      options={c.options}
                      onChange={(v) => onChange(name, v)}
                      disabled={off}
                    />
                  </FormField>
                );
              case "datetime":
                return (
                  <FormField key={name} {...common} bare>
                    <DateTimeRow
                      label={c.label}
                      value={timeValue(value)}
                      onChange={(at) => onChange(name, at ? timeWire(at) : "")}
                      text={timeText}
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
                      accessibilityLabel={c.label}
                      testID={`input-${name}`}
                    />
                  </FormField>
                );
            }
          })}
        </Section>
      )}
    </Screen>
  );
}
