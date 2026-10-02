import React from "react";
import { View } from "react-native";
import type { ActivityModel } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { Button } from "../atoms/Button";
import { Notice } from "../atoms/Notice";
import { Spinner } from "../atoms/Spinner";
import { Text } from "../atoms/Text";
import { DetailRow } from "../molecules/DetailRow";
import { ModelState } from "../molecules/ModelState";
import { Section } from "../molecules/Section";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export interface Props {
  readonly model: ActivityModel;
  readonly onExpand?: (ids: readonly string[]) => void;
  readonly onOpen?: (id: string) => void;
  readonly onMore?: () => void;
  readonly onRetry?: () => void;
}
export function Activity({ model, onExpand, onOpen, onMore, onRetry }: Props) {
  const s = useStyles(kitStyles);
  return (
    <Section title={model.title}>
      {model.excluded ? (
        <Text>{model.excluded}</Text>
      ) : (
        <>
          <ModelState model={model} {...(onRetry ? { onRetry } : {})} />
          {model.rows.map((row) => (
            <View key={row.id} style={s.stack}>
              <View
                accessible
                accessibilityLabel={row.accessibleLabel}
                accessibilityHint={row.time}
              >
                <Text weight="semibold">{row.verb}</Text>
                <Text>{row.actor}</Text>
                <Text>{row.relative}</Text>
              </View>
              {onExpand && (row.changes.length || row.details) ? (
                <Button
                  label={row.expandLabel}
                  tone="plain"
                  expanded={row.expanded}
                  onPress={() => onExpand(row.expansion)}
                />
              ) : null}
              {row.expanded ? (
                <>
                  {row.details ? <Text>{row.details}</Text> : null}
                  {row.changes.map((change) => (
                    <View key={change.id}>
                      <Text role="label">{change.label}</Text>
                      <DetailRow term={model.before} value={change.before} />
                      <DetailRow term={model.after} value={change.after} />
                    </View>
                  ))}
                </>
              ) : null}
              {row.open && onOpen ? (
                <ActionControl model={row.open} onAction={() => onOpen(row.id)} />
              ) : null}
            </View>
          ))}
          {model.pageError ? <Notice text={model.pageError} announcement="urgent" /> : null}
          {model.more && onMore ? (
            model.more.busy ? (
              <View>
                <Text>{model.more.label}</Text>
                <Spinner label={model.more.label} motion="reduced" />
              </View>
            ) : (
              <ActionControl model={model.more} onAction={onMore} testID="activity-more" />
            )
          ) : null}
        </>
      )}
    </Section>
  );
}
export { subject as subjectOf } from "../../core/activity";
