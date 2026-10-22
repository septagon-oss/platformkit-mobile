// AskQuestion is the door a question has nowhere else: the entry the Decide module prints offers
// no CRUD create, because opening a question is a service call that takes the whole list of
// options at once. So the draft lives here — its title, its options, the order they will be sent
// in, and the photo each one may carry — and one press sends it.
import { Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { Entry } from "../../core/catalog";
import { failureSubject, screenPath } from "../../core/derive";
import type { ScreenProps } from "../../renderers";
import { capturePicture, uploadForm, type Picture } from "../../screens/capture";
import { refusalOf } from "../../screens/failure";
import { useFeedback } from "../../screens/useFeedback";
import { usePictures } from "../../screens/usePictures";
import { useShell } from "../../shell";
import { Button } from "../../ui/atoms/Button";
import { Notice, retry } from "../../ui/atoms/Notice";
import { SwitchRow } from "../../ui/atoms/SwitchRow";
import { Text } from "../../ui/atoms/Text";
import { TextField } from "../../ui/atoms/TextField";
import { FormField } from "../../ui/molecules/FormField";
import { Section } from "../../ui/molecules/Section";
import { Screen } from "../../ui/templates/Screen";
import { useStyles, type Theme } from "../../ui/theme";
import { extent } from "../../ui/scale";
import { openWire } from "./wire";

/** DraftOption is one option as it stands on the phone: not yet sent, so it has no id and no position but the one it is drawn at. */
interface DraftOption {
  readonly title: string;
  readonly imageId?: string;
  readonly image?: Picture;
}

interface Draft {
  readonly title: string;
  readonly allowLinkJoin: boolean;
  readonly options: readonly DraftOption[];
}

const EMPTY: Draft = { title: "", allowLinkJoin: false, options: [{ title: "" }, { title: "" }] };

/**
 * AskQuestion collects the draft and opens the question with it. Photos are uploaded before the
 * question exists — a file row is only ever *named* by an option — and a failed upload costs that
 * option its picture, never the draft. The submit is one request; the answer is the question.
 */
export function AskQuestion({ entry }: ScreenProps) {
  const feedback = useFeedback();
  const copy = feedback.copy.decide;
  const { api, entry: lookUp } = useShell();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const files = lookUp("file", "file");
  const options = useMemo(() => ({ title: copy.ask, headerLargeTitleEnabled: false }), [copy.ask]);
  const ask = async () => {
    setSending(true);
    setDetail("");
    try {
      const options = [];
      for (const [position, option] of draft.options.entries()) {
        const title = option.title.trim();
        if (title === "") continue;
        options.push({
          title,
          position,
          ...(option.imageId === undefined ? {} : { imageId: option.imageId }),
        });
      }
      const question = await api.request(
        "POST",
        "/api/v1/decide/questions/open",
        (body) => openWire.parse(body),
        {
          title: draft.title.trim(),
          allowLinkJoin: draft.allowLinkJoin,
          options,
        },
      );
      router.replace(`${screenPath(entry)}/${encodeURIComponent(question.id)}`);
    } catch (error) {
      setDetail(refusalOf(error, "create", failureSubject(entry), feedback.copy).text);
    } finally {
      setSending(false);
    }
  };
  return (
    <>
      <Stack.Screen options={options} />
      <Screen form testID="resource-form">
        {detail ? (
          <Notice
            announcement="urgent"
            text={detail}
            action={retry(feedback, () => setDetail(""))}
            testID="form-detail"
          />
        ) : null}
        <FormField label={copy.questionTitle} required testID="input-decide-title">
          <TextField
            testID="input-decide-title"
            value={draft.title}
            onChangeText={(title) => setDraft({ ...draft, title })}
          />
        </FormField>
        <Section title={copy.option}>
          <OptionDraft
            draft={draft}
            files={files}
            onChanged={(options) => setDraft({ ...draft, options })}
          />
        </Section>
        <SwitchRow
          label={copy.invite}
          value={draft.allowLinkJoin}
          onValueChange={(allowLinkJoin) => setDraft({ ...draft, allowLinkJoin })}
          testID="decide-allow-link-join"
        />
        <Button
          testID="save"
          label={copy.ask}
          tone="primary"
          busy={sending}
          disabled={draft.title.trim() === "" || draft.options.every((o) => o.title.trim() === "")}
          reason={copy.optionAdd}
          onPress={() => void ask()}
        />
      </Screen>
    </>
  );
}

/**
 * OptionDraft draws the options in their order and owns every edit to that order: typing a title,
 * adding, moving and removing an option, and attaching a photo through the file entry's one upload
 * door. Nothing here is sent until the question is opened.
 */
function OptionDraft({
  draft,
  files,
  onChanged,
}: {
  readonly draft: Draft;
  readonly files: Entry | undefined;
  readonly onChanged: (options: readonly DraftOption[]) => void;
}) {
  const feedback = useFeedback();
  const copy = feedback.copy.decide;
  const { api } = useShell();
  const s = useStyles(styles);
  const pictures = usePictures(
    draft.options.flatMap((o) => (o.imageId ? [o.imageId] : [])),
    draft.options.length,
    extent.rowMedia,
  );
  const at = (index: number, option: DraftOption) =>
    onChanged(draft.options.map((o, i) => (i === index ? option : o)));
  const moved = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= draft.options.length) return;
    const options = [...draft.options];
    const [one] = options.splice(index, 1);
    options.splice(to, 0, one!);
    onChanged(options);
  };
  const photographed = async (index: number, via: "camera" | "library") => {
    const taken = await capturePicture(via);
    if (taken.picture === undefined) return;
    if (files === undefined) return;
    try {
      const file = await api.upload(files, uploadForm(taken.picture), "?image=true");
      at(index, { ...draft.options[index]!, image: taken.picture, imageId: String(file.id) });
    } catch {
      // The option keeps its title and loses the photo: a person who cannot attach a picture can
      // still ask their question, and the refusal belongs to the picture, not to the draft.
    }
  };
  return (
    <View style={s.options}>
      {draft.options.map((option, index) => (
        <View key={index} style={s.option} testID="decide-option-row">
          <Text role="label">{`${copy.option} ${index + 1}`}</Text>
          <FormField label={copy.optionTitle} testID={`input-decide-option-title-${index}`}>
            <TextField
              testID={`input-decide-option-title-${index}`}
              value={option.title}
              onChangeText={(title) => at(index, { ...option, title })}
            />
          </FormField>
          {option.imageId ? (
            <View style={s.photo}>
              {pictures.renderImage
                ? pictures.renderImage({
                    id: option.imageId,
                    description: option.title,
                    decorative: true,
                    fit: "cover",
                    aspectRatio: 1,
                  })
                : null}
            </View>
          ) : null}
          {files ? (
            <View style={s.row}>
              <Button
                testID="decide-option-photo-camera"
                label={copy.optionPhotoCamera}
                placement="inline"
                onPress={() => void photographed(index, "camera")}
              />
              <Button
                testID="decide-option-photo-library"
                label={copy.optionPhotoLibrary}
                placement="inline"
                onPress={() => void photographed(index, "library")}
              />
            </View>
          ) : (
            <Text role="caption">{copy.photoRefused}</Text>
          )}
          <View style={s.row}>
            <Button
              testID="decide-option-up"
              label={copy.moveUp}
              placement="inline"
              disabled={index === 0}
              onPress={() => moved(index, -1)}
            />
            <Button
              testID="decide-option-down"
              label={copy.moveDown}
              placement="inline"
              disabled={index === draft.options.length - 1}
              onPress={() => moved(index, 1)}
            />
            <Button
              testID="decide-option-remove"
              label={copy.remove}
              tone="destructive"
              placement="inline"
              onPress={() => onChanged(draft.options.filter((_, i) => i !== index))}
            />
          </View>
        </View>
      ))}
      <Button
        testID="decide-option-add"
        label={copy.optionAdd}
        icon="add"
        placement="inline"
        onPress={() => onChanged([...draft.options, { title: "" }])}
      />
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    options: { gap: t.space.md },
    option: { gap: t.space.sm },
    row: { flexDirection: "row", gap: t.space.sm },
    photo: { width: t.extent.rowMedia, height: t.extent.rowMedia },
  });
