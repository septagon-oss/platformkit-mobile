// ResourceDetail is one row as a pure component: every field in schema order,
// and, for a caller who may write, the destructive row at the foot. Edit
// lives in the native header, which the screen composition sets.
import React from "react";
import type { Entry } from "../../core/catalog";
import { type Feedback, detailItems, type Row as Item } from "../../core/derive";
import { Notice, retry } from "../atoms/Notice";
import { Actions, type Props as ActionsProps } from "./Actions";
import { Activity, type Props as ActivityProps } from "./Activity";
import { Skeleton } from "../atoms/Skeleton";
import { DetailRow } from "../molecules/DetailRow";
import { Value } from "../molecules/Value";
import { Row } from "../molecules/Row";
import { Section } from "../molecules/Section";
import { Screen } from "../templates/Screen";

export interface Props {
  readonly feedback: Feedback;
  readonly entry: Entry;
  readonly row: Item | undefined;
  readonly error: string;
  readonly onRetry: () => void;
  readonly onDelete?: () => void;
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
  onRetry,
  onDelete,
  activity,
  actions,
}: Props) {
  return (
    <Screen testID="resource-detail">
      {error ? (
        <Notice announcement="urgent" text={error} action={retry(feedback, onRetry)} />
      ) : null}
      {row ? (
        <Section>
          {detailItems(entry, row, feedback).map((item) => (
            <DetailRow
              key={item.field.name}
              testID={`field-${item.field.name}`}
              term={item.label}
              value={item.value}
              {...(item.spoken === undefined ? {} : { spoken: item.spoken })}
              shown={
                <Value presentation={feedback} field={item.field} value={row[item.field.name]} />
              }
            />
          ))}
        </Section>
      ) : error ? null : (
        <Section>
          <Skeleton label={feedback.loadingLabel} motion={feedback.motion} lines={5} />
        </Section>
      )}
      {row && actions ? <Actions {...actions} /> : null}
      {row && activity ? <Activity {...activity} /> : null}
      {row && onDelete ? (
        <Section footer="Deleting cannot be undone.">
          <Row
            title={`Delete ${entry.entity}`}
            tone="destructive"
            onPress={onDelete}
            testID="delete"
          />
        </Section>
      ) : null}
    </Screen>
  );
}
