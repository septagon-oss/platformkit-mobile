// Gallery is every atom and molecule with sample props, in both modes, on one
// screen: the place a person looks at the library rather than at a resource,
// as the web shell's component gallery is. It ships only in builds that ask
// for it (app/gallery.tsx); nothing here names an entity.
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  deriveCopy,
  deriveFeedback,
  stateExamples,
  timeText,
  type Feedback,
  type Language,
  type Presentation,
} from "../core/derive";
import { Badge } from "./atoms/Badge";
import { Button } from "./atoms/Button";
import { ChoiceRow } from "./atoms/ChoiceRow";
import { DateTimeRow } from "./atoms/DateTimeRow";
import { Icon } from "./atoms/Icon";
import { Notice } from "./atoms/Notice";
import { Spinner } from "./atoms/Spinner";
import { SwitchRow } from "./atoms/SwitchRow";
import { Text } from "./atoms/Text";
import { TextField } from "./atoms/TextField";
import { DetailRow } from "./molecules/DetailRow";
import { FormField } from "./molecules/FormField";
import { LoadMore } from "./molecules/LoadMore";
import { Row } from "./molecules/Row";
import { Section } from "./molecules/Section";
import { ServerField } from "./molecules/ServerField";
import { TagsField } from "./molecules/TagsField";
import { Value } from "./molecules/Value";
import { Screen } from "./templates/Screen";
import { ThemeProvider, useStyles, type Theme, type Palette, type Fonts } from "./theme";
import { StateView, type Props as StateViewProps } from "./molecules/StateView";
import type { Mode } from "./tokens";

const choices = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
];

interface Props {
  readonly presentation: Presentation;
  readonly palette?: Readonly<Record<Mode, Palette>>;
  readonly fonts?: Fonts;
  readonly initialCaseId?: string;
  readonly initialMode?: Mode;
  /** Screen composition can supply its native announcement adapter. */
  readonly renderState?: (props: StateViewProps) => React.ReactNode;
}

const stateView = (props: StateViewProps) => <StateView {...props} />;

export function Gallery({
  presentation,
  palette,
  fonts,
  initialCaseId = "primitives/default",
  initialMode = "light",
  renderState = stateView,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [language, setLanguage] = useState<Language>();
  const [locale, setLocale] = useState<string>();
  const [caseId, setCaseId] = useState(initialCaseId);
  const [action, setAction] = useState("");
  const copy = language ? deriveCopy(language) : presentation.copy;
  const shown = { ...presentation, copy, locale: locale ?? presentation.locale };
  const cases = stateExamples(shown);
  const example = cases.ok ? cases.value.find((item) => item.id === caseId) : undefined;
  const words = copy.gallery;
  const feedback = deriveFeedback(copy, shown.motion, shown);
  return (
    <ThemeProvider mode={mode} {...(palette ? { palette } : {})} {...(fonts ? { fonts } : {})}>
      <Screen form testID="gallery">
        <Section title={words.appearance}>
          <ChoiceRow
            copy={copy.choice}
            label={words.appearance}
            value={mode}
            options={[
              { value: "light", label: words.light },
              { value: "dark", label: words.dark },
            ]}
            onChange={(value) => setMode(value === "dark" ? "dark" : "light")}
            testID="gallery-mode"
          />
          <ChoiceRow
            copy={copy.choice}
            label={words.language}
            value={copy.language}
            options={[
              { value: "en", label: words.english },
              { value: "pt", label: words.portuguese },
            ]}
            onChange={(value) => setLanguage(value === "pt" ? "pt" : "en")}
            testID="gallery-language"
          />
          <ChoiceRow
            copy={copy.choice}
            label={words.locale}
            value={shown.locale}
            options={[...new Set([presentation.locale, "en-GB", "pt-PT", "pt-BR"])].map(
              (value) => ({ value, label: value }),
            )}
            onChange={setLocale}
            testID="gallery-locale"
          />
          <ChoiceRow
            copy={copy.choice}
            label={words.case}
            value={caseId}
            options={[
              { value: "primitives/default", label: words.primitives },
              ...(cases.ok ? cases.value.map(({ id }) => ({ value: id, label: id })) : []),
            ]}
            onChange={(id) => {
              setCaseId(id);
              setAction("");
            }}
            testID="gallery-case"
          />
        </Section>
        {caseId === "primitives/default" ? (
          <Samples feedback={feedback} />
        ) : example ? (
          <Section title={words.states}>
            {example.renderer === "spinner" ? (
              <Spinner
                label={example.model.loadingLabel}
                motion={example.model.motion}
                testID="gallery-spinner"
              />
            ) : (
              renderState({ model: example.model, onAction: setAction, testID: "gallery-state" })
            )}
            <Text accessibilityLiveRegion="polite" testID="gallery-action">
              {action ? words.actionReceived(action) : ""}
            </Text>
          </Section>
        ) : (
          <Notice text={copy.issue.invalid} announcement="urgent" />
        )}
      </Screen>
    </ThemeProvider>
  );
}

function Samples({ feedback }: { readonly feedback: Feedback }) {
  const s = useStyles(styles);
  const [on, setOn] = useState(true);
  const [choice, setChoice] = useState("open");
  const [at, setAt] = useState<Date | undefined>(new Date("2026-01-31T09:00:00Z"));
  const [tags, setTags] = useState("alpha, beta");
  const [server, setServer] = useState("https://acme.example.com");
  const [words, setWords] = useState("");
  const none = () => undefined;
  return (
    <>
      <Section title="Text">
        <View style={s.stack}>
          <Text role="display">Display, the serif</Text>
          <Text role="title" weight="semibold">
            Title
          </Text>
          <Text>Body, the system face</Text>
          <Text role="label" tone="muted">
            Label, muted
          </Text>
          <Text role="caption" uppercase tone="muted">
            Caption, uppercase
          </Text>
          <Text role="mono">3f2a9c…-mono</Text>
          <Text tone="accent">Accent</Text>
          <Text tone="danger">Danger</Text>
        </View>
      </Section>

      <Section title="Buttons">
        <View style={s.wrap}>
          <Button label="Primary" onPress={none} />
          <Button label="Secondary" onPress={none} tone="secondary" />
          <Button label="Delete" onPress={none} tone="destructive" icon="trash" />
          <Button label="Plain" onPress={none} tone="plain" />
          <Button label="Busy" onPress={none} busy />
          <Button label="Off" onPress={none} disabled />
          <Button label="Save" onPress={none} placement="header" />
        </View>
      </Section>

      <Section title="Badges and icons">
        <View style={s.wrap}>
          <Badge label="Ok" tone="ok" />
          <Badge label="Warning" tone="warning" />
          <Badge label="Danger" tone="danger" />
          <Badge label="Info" tone="info" />
          <Badge label="Neutral" />
        </View>
        <View style={s.wrap}>
          {(["add", "chevron", "edit", "trash", "more", "person", "server", "sort"] as const).map(
            (n) => (
              <Icon key={n} name={n} label={n} />
            ),
          )}
        </View>
      </Section>

      <Section title="Fields">
        <FormField label="Words" required help="Some help under the field.">
          <TextField
            value={words}
            onChangeText={setWords}
            placeholder="Type here"
            accessibilityLabel="Words"
          />
        </FormField>
        <FormField label="Refused" error="is required">
          <TextField value="" onChangeText={none} invalid accessibilityLabel="Refused" />
        </FormField>
        <FormField label="Notes">
          <TextField kind="textarea" value="" onChangeText={none} accessibilityLabel="Notes" />
        </FormField>
        <FormField label="Amount">
          <TextField kind="number" value="1,5" onChangeText={none} accessibilityLabel="Amount" />
        </FormField>
        <FormField label="Identifier" help="The identifier of the related record.">
          <TextField
            kind="mono"
            value="3f2a9c1e"
            onChangeText={none}
            accessibilityLabel="Identifier"
          />
        </FormField>
        <FormField label="Pinned" bare>
          <SwitchRow label="Pinned" value={on} onValueChange={setOn} help="A yes or a no." />
        </FormField>
        <FormField label="Status" bare>
          <ChoiceRow
            copy={feedback.copy.choice}
            label="Status"
            value={choice}
            options={choices}
            onChange={setChoice}
          />
        </FormField>
        <FormField label="Due" bare>
          <DateTimeRow
            label="Due"
            value={at}
            onChange={setAt}
            text={(value) => timeText(value, feedback)}
          />
        </FormField>
        <FormField label="Tags" help="Comma separated.">
          <TagsField label="Tags" value={tags} onChange={setTags} />
        </FormField>
        <ServerField value={server} onChange={setServer} />
      </Section>

      <Section title="Rows" footer="A footer says something about the group.">
        <Row title="A row that opens" cells={["Status: Open", "Rank: 2"]} onPress={none} />
        <Row title="A row that does not" cells={["Read only"]} />
        <Row title="Delete" tone="destructive" onPress={none} />
      </Section>

      <Section title="Details">
        <DetailRow term="Title" value="A note" />
        <DetailRow
          term="Id"
          value="3f2a9c1e-1b2c-4d5e-8f90-123456789abc"
          shown={
            <Value
              presentation={feedback}
              field={{ name: "id", type: "uuid" }}
              value="3f2a9c1e-1b2c-4d5e-8f90-123456789abc"
            />
          }
        />
        <DetailRow
          term="Status"
          value="Open"
          shown={
            <Value
              presentation={feedback}
              field={{ name: "status", type: "string", enum: ["open", "done"] }}
              value="open"
            />
          }
        />
        <DetailRow
          term="Pinned"
          value="Yes"
          shown={
            <Value presentation={feedback} field={{ name: "pinned", type: "bool" }} value={true} />
          }
        />
        <DetailRow
          term="Due at"
          value="Jan 31, 2026, 09:00 AM UTC"
          shown={
            <Value
              presentation={feedback}
              field={{ name: "dueAt", type: "time" }}
              value="2026-01-31T09:00:00Z"
            />
          }
        />
        <DetailRow
          term="Tags"
          value="alpha, beta"
          shown={
            <Value
              presentation={feedback}
              field={{ name: "tags", type: "list", elem: "string" }}
              value={["alpha", "beta"]}
            />
          }
        />
        <DetailRow term="Body" value="—" />
      </Section>

      <LoadMore feedback={feedback} remaining={12} busy={false} onPress={none} />
    </>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    stack: { gap: t.space.xs, paddingVertical: t.space.sm },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: t.space.sm, paddingVertical: t.space.sm },
  });
