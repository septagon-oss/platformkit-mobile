// ResourceDetail is one row as a pure component: every field in schema order,
// and, for a caller who may write, the destructive row at the foot. Edit
// lives in the native header, which the screen composition sets.
import React from "react";
import type { Entry } from "../../core/catalog";
import { detailItems, type Row as Item } from "../../core/derive";
import { Notice } from "../atoms/Notice";
import { Skeleton } from "../atoms/Skeleton";
import { DetailRow } from "../molecules/DetailRow";
import { Row } from "../molecules/Row";
import { Section } from "../molecules/Section";
import { Screen } from "../templates/Screen";

export interface Props {
  readonly entry: Entry;
  readonly row: Item | undefined;
  readonly error: string;
  readonly onRetry: () => void;
  readonly onDelete?: () => void;
}

export function ResourceDetail({ entry, row, error, onRetry, onDelete }: Props) {
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
                mono={field?.type === "uuid" || field?.widget === "entity-picker"}
              />
            );
          })}
        </Section>
      ) : error ? null : (
        <Section>
          <Skeleton lines={5} />
        </Section>
      )}
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
