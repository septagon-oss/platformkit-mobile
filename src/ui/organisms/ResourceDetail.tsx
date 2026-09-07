// ResourceDetail is one row as a pure component: every field in schema order,
// and, for a caller who may write, the destructive row at the foot. Edit
// lives in the native header, which the screen composition sets.
import React from "react";
import type { Entry } from "../../core/catalog";
import { detailItems, type Row as Item } from "../../core/derive";
import { Notice } from "../atoms/Notice";
import { Actions, type Props as ActionsProps } from "./Actions";
import { Activity, type Props as ActivityProps } from "./Activity";
import { Skeleton } from "../atoms/Skeleton";
import { DetailRow } from "../molecules/DetailRow";
import { Value } from "../molecules/Value";
import { Row } from "../molecules/Row";
import { Section } from "../molecules/Section";
import { Screen } from "../templates/Screen";

export interface Props {
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

export function ResourceDetail({ entry, row, error, onRetry, onDelete, activity, actions }: Props) {
  return (
    <Screen testID="resource-detail">
      {error ? <Notice text={error} action={{ label: "Retry", onPress: onRetry }} /> : null}
      {row ? (
        <Section>
          {detailItems(entry, row).map((item, i) => {
            const field = entry.fields[i];
            return (
              <DetailRow
                key={item.label}
                term={item.label}
                value={item.value}
                {...(field ? { shown: <Value field={field} value={row[field.name]} /> } : {})}
              />
            );
          })}
        </Section>
      ) : error ? null : (
        <Section>
          <Skeleton lines={5} />
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
