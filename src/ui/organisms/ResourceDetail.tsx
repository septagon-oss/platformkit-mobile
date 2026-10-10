// ResourceDetail is one record as a pure component: what distinguishes it, then the
// fields that have values in the blocks the entry declares, then the commands, the
// trail, and the record's own information collapsed at the end. Which field is
// drawn where is `recordHeader`, `recordSections` and `recordInformation`'s — this
// file draws what they answer and decides nothing of its own.
//
// Edit and the `…` that holds Delete live in the native header, which the screen
// composition sets; the menu itself opens here, under the header, because that is
// where the person looked when they pressed it.
import React from "react";
import { View } from "react-native";
import type { Entry } from "../../core/catalog";
import {
  failureSubject,
  failureTone,
  nounPhrase,
  recordHeader,
  recordInformation,
  recordSections,
  refusalAction,
  type DetailItem,
  type DisclosureModel,
  type Feedback,
  type FailureVerdict,
  type Row as Item,
} from "../../core/derive";
import { Notice } from "../atoms/Notice";
import { Badge } from "../atoms/Badge";
import { Text } from "../atoms/Text";
import { Actions, type Props as ActionsProps } from "./Actions";
import { Activity, type Props as ActivityProps } from "./Activity";
import { Skeleton } from "../atoms/Skeleton";
import { DetailRow } from "../molecules/DetailRow";
import { Value } from "../molecules/Value";
import { Row } from "../molecules/Row";
import { Section } from "../molecules/Section";
import { SummaryDetail } from "../templates/SummaryDetail";
import { Screen } from "../templates/Screen";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";

export interface Props {
  readonly feedback: Feedback;
  readonly entry: Entry;
  readonly row: Item | undefined;
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
}

export function ResourceDetail({
  feedback,
  entry,
  row,
  error,
  saved = "",
  refusal,
  onRetry,
  onDismiss,
  onBack,
  menuOpen,
  onDelete,
  information,
  activity,
  actions,
}: Props) {
  const s = useStyles(kitStyles);
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
  const header = row ? recordHeader(entry, row, feedback, feedback.copy.kit.untitled) : undefined;
  const blocks = row ? recordSections(entry, row, feedback) : [];
  const details = row ? recordInformation(entry, row, feedback) : [];
  return (
    <Screen testID="resource-detail">
      {saved ? <Notice testID="record-saved" tone="ok" announcement="polite" text={saved} /> : null}
      {error ? (
        <Notice
          testID="refusal"
          tone={failureTone(refusal)}
          announcement="urgent"
          text={error}
          {...(notice ? { action: notice } : {})}
        />
      ) : null}
      {row ? (
        <>
          {header?.status || header?.summary ? (
            <View style={s.stack}>
              {header.status ? (
                <Badge label={header.status.label} tone={header.status.tone} />
              ) : null}
              {header.summary ? <Text>{header.summary}</Text> : null}
            </View>
          ) : null}
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
          {blocks.map((block) => (
            <Section key={block.key || "overview"} title={block.label}>
              {block.items.map((item) => (
                <RecordFact key={item.field.name} feedback={feedback} item={item} row={row} />
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
            <RecordFact key={item.field.name} feedback={feedback} item={item} row={row} />
          ))}
        </SummaryDetail>
      ) : null}
    </Screen>
  );
}

/**
 * RecordFact is one fact about a record: the label the author gave the field, the
 * value in the shape its type deserves, and the row named after the field, so a
 * journey finds it by the name the API document gives it and never by the label's
 * spelling. Every block draws its rows this way, Record information included.
 */
function RecordFact({
  feedback,
  item,
  row,
}: {
  readonly feedback: Feedback;
  readonly item: DetailItem;
  readonly row: Item;
}) {
  return (
    <DetailRow
      testID={`field-${item.field.name}`}
      term={item.label}
      value={item.value}
      {...(item.spoken === undefined ? {} : { spoken: item.spoken })}
      shown={<Value presentation={feedback} field={item.field} value={row[item.field.name]} />}
    />
  );
}
