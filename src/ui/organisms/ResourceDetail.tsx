// ResourceDetail is one record as a pure component: what distinguishes it, then the
// fields that have values in the blocks the entry declares, then the commands, the
// trail, and the record's own information collapsed at the end. Which field is
// drawn where is `recordHeader`, `recordSections` and `recordInformation`'s — this
// file draws what they answer and decides nothing of its own.
//
// Edit and the `…` that holds Delete live in the native header, which the screen
// composition sets; the menu itself opens here, under the header, because that is
// where the person looked when they pressed it.
import React, { type ReactNode, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Entry } from "../../core/catalog";
import type { Motion } from "../../core/presentation";
import {
  failureSubject,
  failureTone,
  nounPhrase,
  recordCover,
  recordHeader,
  recordInformation,
  recordSections,
  refusalAction,
  richBody,
  translationNote,
  type DetailItem,
  type DisclosureModel,
  type FileMeta,
  type Names,
  type People,
  type PictureStates,
  type Feedback,
  type FailureVerdict,
  type Row as Item,
  type StateModel,
} from "../../core/derive";
import { Notice } from "../atoms/Notice";
import { Badge, type BadgeTone } from "../atoms/Badge";
import { Text } from "../atoms/Text";
import { Actions, type Props as ActionsProps } from "./Actions";
import { Activity, type Props as ActivityProps } from "./Activity";
import { RecordCover, type CoverMotion } from "./RecordCover";
import { Skeleton } from "../atoms/Skeleton";
import { DetailRow } from "../molecules/DetailRow";
import { ModelState } from "../molecules/ModelState";
import type { ImageRenderer } from "../molecules/MediaHero";
import { PhotoStrip } from "../molecules/PhotoStrip";
import { Value } from "../molecules/Value";
import { Row } from "../molecules/Row";
import { SaveButton, type SaveButtonModel } from "../molecules/SaveButton";
import { Section } from "../molecules/Section";
import { SummaryDetail } from "../templates/SummaryDetail";
import { Screen } from "../templates/Screen";
import { kitStyles } from "../layout";
import { useStyles, useTheme, type Theme } from "../theme";

export interface Props {
  readonly people?: People | undefined;
  readonly pictureStates?: PictureStates | undefined;
  readonly renderImage?: ImageRenderer | undefined;
  readonly feedback: Feedback;
  readonly entry: Entry;
  readonly row: Item | undefined;
  /**
   * names is what this screen resolved of the records this row points at. Every
   * value drawn below reads through it, so a pointer is a name or the word
   * saying there is one, and never the identifier the row holds for it.
   */
  readonly names?: Names | undefined;
  readonly error: string;
  /**
   * saved is the sentence a write said — "Note created", "Changes saved". The screen
   * that wrote is on its way out when it says it, so it arrives here, where the record
   * it is about is drawn, and it is read once by whoever holds it.
   */
  readonly saved?: string;
  /** refusal names which sentence this is and what the person may do next; without
   * it the notice is the plain retry it always was. */
  readonly refusal?: FailureVerdict;
  readonly onRetry: () => void;
  /**
   * offline is the sentence a record says when it came from this phone rather
   * than the server, derived once in core (deriveOffline) and drawn by the same
   * molecule a list draws it through: one line, wherever a stored answer is shown.
   */
  readonly offline?: StateModel;
  readonly onDismiss?: () => void;
  readonly onBack?: () => void;
  /**
   * menuOpen says the header's `…` has been pressed. The button lives in the native
   * header and the answer lives here, so the screen that set one passes the state to
   * the other; no dialog is opened, which is why the question Delete asks next cannot
   * race a dismissing window.
   */
  readonly menuOpen?: boolean;
  /** onDelete is the record's destructive action. Whoever owns the menu closes it. */
  readonly onDelete?: () => void;
  /**
   * information is the collapsed Record information disclosure: the model the screen
   * holds, because a disclosure's open state is the screen's, like the trail's model
   * above. What it holds is this organism's rule, read from the entry and the row.
   */
  readonly information?: {
    readonly model: DisclosureModel;
    readonly onExpanded: (open: boolean) => void;
  };
  /**
   * activity is the record's trail, when the caller may read it. It is a prop
   * and not a fetch, like everything else here: the screen reads, the section
   * draws.
   */
  readonly activity?: ActivityProps;
  /** actions are the lifecycle commands this caller may run on the record. */
  readonly actions?: ActionsProps;
  /**
   * save is this record's own keeping control: the state the screen read from the server, and
   * the press that asks for the act. Absent means nothing is kept of this record here — the
   * entry declares nothing, this build composes no read of a person's copies, or nobody has
   * answered yet — and the record is drawn with no control at all rather than an inert one.
   */
  readonly save?: { readonly model: SaveButtonModel; readonly onPress: () => void };
  /**
   * richText draws one rich text body as the phone reads it. The screen supplies it, and
   * with it the Markdown face and the figure loader this layer cannot own. `fallback` is
   * the value shape this organism already built: a surface that cannot read this whole
   * body draws that, so a refusal costs the record its native type and never a line of it.
   * Absent means this surface has no reader at all.
   */
  readonly richText?: (body: string, testID: string, fallback: ReactNode) => ReactNode;
  /**
   * finishing is this record's own finishing moment: the sentence that says what its state became,
   * and — when the person asked for motion and the product ships a renderer — the burst drawn over
   * the record surface and the word for the state the mark is drawn in. Absent means this record
   * reached nothing: it is drawn exactly as it was, with no line and no overlay.
   */
  readonly finishing?: {
    readonly words: string;
    readonly state?: BadgeTone;
    readonly burst?: Finishing | undefined;
    readonly onEnd: () => void;
  };
  /**
   * files is what this phone read of each file the row points at — the frame the server
   * probed, the caption, whether the picture carries information. Absent, or no entry for
   * an id, means the record draws its facts and no pictures: the header block stays.
   */
  readonly files?: Readonly<Record<string, FileMeta>> | undefined;
  /** onOpenPhoto opens one of the record's own pictures full size, by its file identifier. */
  readonly onOpenPhoto?: (field: string, id: string) => void;
  /**
   * coverMotion is the motion a product chose for a cover being scrolled away, supplied once
   * at composition. Absent means the photo holds still and scrolls with the page.
   */
  readonly coverMotion?: CoverMotion | undefined;
}

/**
 * FinishingProps is what the record surface hands the motion layer for its finishing moment: the
 * tone the arrived state wears, the person's motion preference, and the call that says the drawn
 * burst is over. A renderer moves ink and says nothing: the words below are drawn here, so a
 * product that supplies no renderer keeps this tree whole and simply draws no overlay.
 */
export interface FinishingProps {
  readonly tone: BadgeTone;
  readonly motion: Motion;
  readonly onEnd: () => void;
}
export type Finishing = (props: FinishingProps) => ReactNode;

export function ResourceDetail({
  feedback,
  entry,
  row,
  names,
  people,
  pictureStates,
  renderImage,
  error,
  saved = "",
  refusal,
  onRetry,
  offline,
  onDismiss,
  onBack,
  menuOpen,
  onDelete,
  information,
  activity,
  actions,
  save,
  richText,
  files,
  onOpenPhoto,
  coverMotion,
  finishing,
}: Props) {
  const s = useStyles(kitStyles),
    t = useTheme(),
    insets = useSafeAreaInsets();
  const viewport = useWindowDimensions();
  // How far this page has scrolled is asked for only when there is a cover to collapse.
  const [offset, setOffset] = useState(0);
  const chrome = useStyles(styles);
  // Which button a refusal offers is the classifier's answer, not this
  // component's: a forbidden record is left, an unanswered write is checked
  // rather than sent again, and a sentence with no way out is only a sentence.
  // Its colour is the classifier's answer too — the one refusal that is not of
  // this person's doing is drawn as a caution.
  const notice = refusal
    ? refusalAction(
        refusal,
        feedback.copy,
        {
          retry: onRetry,
          reconcile: onRetry,
          dismiss: onDismiss ?? onRetry,
          back: onBack ?? onRetry,
        },
        failureSubject(entry),
      )
    : undefined;
  const header = row
    ? recordHeader(entry, row, feedback, feedback.copy.kit.untitled, names)
    : undefined;
  // One frame answers both surfaces a picture of this record is drawn in: the cover is as
  // wide as the page and as tall as `extent.cover`; a gallery's tile is square.
  const frame = { width: Math.round(viewport.width), height: t.extent.cover };
  // The metadata the picture door read is the difference between a record that can show
  // its pictures and one that cannot: with no read there were no ids to ask for, so a
  // block draws its facts and no empty tiles.
  const media =
    files === undefined ? undefined : { pictures: { states: pictureStates ?? {}, files }, frame };
  const blocks = row ? recordSections(entry, row, feedback, names, media) : [];
  const details = row ? recordInformation(entry, row, feedback, names) : [];
  // The picture the record opens on, with the record's own name standing on it.
  const cover =
    row === undefined || media === undefined
      ? undefined
      : recordCover(entry, row, media.pictures, frame);
  const collapseAt = t.extent.cover - t.extent.headerBar;
  const collapsed = cover !== undefined && offset >= collapseAt;
  return (
    <View style={chrome.page}>
      <Screen testID="resource-detail" {...(cover === undefined ? {} : { onOffset: setOffset })}>
        {saved ? (
          <Notice testID="record-saved" tone="ok" announcement="polite" text={saved} />
        ) : null}
        {error ? (
          <Notice
            testID="refusal"
            tone={failureTone(refusal)}
            announcement="urgent"
            text={error}
            {...(notice ? { action: notice } : {})}
          />
        ) : null}
        {offline ? (
          <ModelState
            model={{ notice: offline, refreshing: false, writable: false }}
            onRetry={onRetry}
          />
        ) : null}
        {row ? (
          <>
            {finishing ? (
              /* The record's own line, said once in a voice a screen reader is told to wait for,
                and drawn whether or not anything moves: it is what the moment says when nothing
                may be drawn, and it is what stays on screen after the burst has gone. */
              <Text testID="record-finished" accessibilityLiveRegion="polite">
                {finishing.words}
              </Text>
            ) : null}
            {cover !== undefined && header ? (
              <RecordCover
                cover={cover}
                header={header}
                feedback={feedback}
                offset={offset}
                collapseAt={collapseAt}
                {...(renderImage === undefined ? {} : { renderImage })}
                {...(coverMotion === undefined ? {} : { coverMotion })}
              />
            ) : null}
            {cover === undefined && (header?.status || header?.summary) ? (
              <View style={s.stack}>
                {header.status ? (
                  <Badge
                    label={header.status.label}
                    tone={header.status.tone}
                    motion={feedback.motion}
                  />
                ) : null}
                {header.summary ? <Text>{header.summary}</Text> : null}
              </View>
            ) : null}
            {finishing?.burst
              ? /* The burst is drawn over the record's own surface, above the cover it belongs to
                and below nothing: it is a thing happening to this record, not a dialog, so it takes
                no focus, answers no press, and asks for nothing when it is over but its one call. */
                finishing.burst({
                  tone: finishing.state ?? "neutral",
                  motion: feedback.motion,
                  onEnd: finishing.onEnd,
                })
              : null}
            {/* What the `…` in the native header opened, drawn directly under the header
              it belongs to and above every row of the record: a person pressed a button
              at the top of the screen, so the answer appears where they were looking —
              not at the foot of a scroll view they have to hunt down. */}
            {onDelete && menuOpen ? (
              <Section>
                <Row
                  title={feedback.copy.kit.deleteAction(nounPhrase(entry).singular)}
                  tone="destructive"
                  onPress={onDelete}
                  testID="delete"
                />
              </Section>
            ) : null}
            {/* Keeping a copy is an act on this record, so it is drawn on the record: one
              labelled control above its fields, never a bare glyph in the header competing
              with the word Edit. */}
            {row && save ? (
              <Section>
                <SaveButton model={save.model} onPress={save.onPress} />
              </Section>
            ) : null}
            {blocks.map((block) => (
              <Section key={block.key || "overview"} title={block.label}>
                {block.items.map((item) => (
                  <RecordFact
                    key={item.field.name}
                    feedback={feedback}
                    item={item}
                    row={row}
                    names={names}
                    people={people}
                    pictureStates={pictureStates}
                    renderImage={renderImage}
                    {...(richText === undefined ? {} : { richText })}
                  />
                ))}
                {block.strips.map((strip) => (
                  <PhotoStrip
                    key={strip.field.name}
                    strip={strip}
                    feedback={feedback}
                    {...(renderImage === undefined ? {} : { renderImage })}
                    {...(onOpenPhoto === undefined
                      ? {}
                      : { onOpen: (id: string) => onOpenPhoto(strip.field.name, id) })}
                  />
                ))}
              </Section>
            ))}
          </>
        ) : error ? null : (
          <Section>
            <Skeleton label={feedback.loadingLabel} motion={feedback.motion} lines={5} />
          </Section>
        )}
        {row && actions ? <Actions {...actions} /> : null}
        {row && activity ? <Activity {...activity} /> : null}
        {row && information && details.length > 0 ? (
          <SummaryDetail
            testID="record-information"
            model={information.model}
            onExpanded={information.onExpanded}
          >
            {details.map((item) => (
              <RecordFact
                key={item.field.name}
                feedback={feedback}
                item={item}
                row={row}
                names={names}
                people={people}
                pictureStates={pictureStates}
                renderImage={renderImage}
                {...(richText === undefined ? {} : { richText })}
              />
            ))}
          </SummaryDetail>
        ) : null}
      </Screen>
      {/* Once the photo is scrolled away the page names the record itself, in the band the
          transparent native header left above the content: the two buttons the flows tap
          stayed in that header, so this is the page's half of the bar, drawn as a cut — a
          band that fades in over a scroll-driven transform is a re-render every frame. */}
      {collapsed && header ? (
        <View
          style={[chrome.bar, { top: insets.top + t.extent.headerBar }]}
          testID="record-title-bar"
          accessibilityLiveRegion="none"
        >
          <Text role="label" numberOfLines={1}>
            {header.title}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: t.color.surfaceCanvas },
    bar: {
      position: "absolute",
      left: 0,
      right: 0,
      paddingHorizontal: t.space.lg,
      paddingVertical: t.space.sm,
      backgroundColor: t.color.surfacePrimary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: t.color.borderDefault,
    },
  });
/**
 * RecordFact is one fact about a record: the label the author gave the field, the
 * value in the shape its type deserves, and the row named after the field, so a
 * journey finds it by the name the API document gives it and never by the label's
 * spelling. A field whose author declared rich text is read by `richText` where a
 * reader was supplied and the body can be read whole (`richBody`, and `richText`'s own
 * answer for a body it cannot read); every other value takes the shape `Value` gives it.
 * Every block draws its rows this way, Record information included.
 */
function RecordFact({
  feedback,
  item,
  row,
  names,
  people,
  pictureStates,
  renderImage,
  richText,
}: {
  readonly feedback: Feedback;
  readonly item: DetailItem;
  readonly row: Item;
  readonly names?: Names | undefined;
  readonly people?: People | undefined;
  readonly pictureStates?: PictureStates | undefined;
  readonly renderImage?: ImageRenderer | undefined;
  readonly richText?: Props["richText"] | undefined;
}) {
  const stored = row[item.field.name];
  const plain = (
    <Value
      presentation={feedback}
      decorative
      instance={JSON.stringify([row.id, item.field.name])}
      field={item.field}
      value={stored}
      names={names}
      people={people}
      pictureStates={pictureStates}
      renderImage={renderImage}
    />
  );
  const body = richText === undefined ? undefined : richBody(item.field, stored);
  const shown =
    body === undefined || richText === undefined
      ? plain
      : richText(body, `field-${item.field.name}-prose`, plain);
  // Whose words these are, when they are not the reader's: the server names the language
  // each translatable field arrived in, and a person reading in another is told which one
  // this is rather than left to assume their own (`translationNote`).
  const served = translationNote(item.field, row, feedback);
  return (
    <DetailRow
      testID={`field-${item.field.name}`}
      term={item.label}
      value={item.value}
      {...(item.spoken === undefined ? {} : { spoken: item.spoken })}
      shown={
        served === undefined ? (
          shown
        ) : (
          <>
            {shown}
            <Text role="caption" tone="muted" testID={`field-${item.field.name}-language`}>
              {served}
            </Text>
          </>
        )
      }
    />
  );
}
