// Gallery is every atom and molecule with sample props, in both modes, on one
// screen: the place a person looks at the library rather than at a resource,
// as the web shell's component gallery is. It ships only in builds that ask
// for it (app/gallery.tsx); nothing here names an entity.
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { timeText } from "../core/derive";
import { Badge } from "./atoms/Badge";
import { Button } from "./atoms/Button";
import { ChoiceRow } from "./atoms/ChoiceRow";
import { DateTimeRow } from "./atoms/DateTimeRow";
import { EmptyState } from "./atoms/EmptyState";
import { Icon } from "./atoms/Icon";
import { Notice } from "./atoms/Notice";
import { Skeleton } from "./atoms/Skeleton";
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
import { Screen } from "./templates/Screen";
import { ThemeProvider, useStyles, type Theme } from "./theme";
import type { Mode } from "./tokens";

const choices = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
];

export function Gallery() {
  const [mode, setMode] = useState<Mode>("light");
  return (
    <ThemeProvider mode={mode}>
      <Screen form testID="gallery">
        <Section title="Mode">
          <ChoiceRow
            label="Appearance"
            value={mode}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            onChange={(v) => setMode(v === "dark" ? "dark" : "light")}
            testID="gallery-mode"
          />
        </Section>
        <Samples />
      </Screen>
    </ThemeProvider>
  );
}

function Samples() {
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

      <Section title="Notices">
        <Notice
          text="The server could not be reached."
          action={{ label: "Retry", onPress: none }}
        />
        <Notice tone="warning" title="Heads up" text="A warning with a title." />
        <Notice tone="info" text="Something to know." />
        <Notice tone="ok" text="Saved." />
      </Section>

      <Section title="Waiting and nothing">
        <Spinner />
        <Skeleton />
        <EmptyState
          title="Nothing here yet"
          text="What arrives will be listed."
          action={{ label: "Refresh", onPress: none }}
        />
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
          <ChoiceRow label="Status" value={choice} options={choices} onChange={setChoice} />
        </FormField>
        <FormField label="Due" bare>
          <DateTimeRow label="Due" value={at} onChange={setAt} text={timeText} />
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
        <DetailRow term="Id" value="3f2a9c1e-1b2c-4d5e-8f90-123456789abc" mono />
        <DetailRow term="Body" value="—" />
      </Section>

      <LoadMore remaining={12} busy={false} onPress={none} />
    </>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    stack: { gap: t.space.xs, paddingVertical: t.space.sm },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: t.space.sm, paddingVertical: t.space.sm },
  });
