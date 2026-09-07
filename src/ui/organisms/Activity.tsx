// Activity is a record's trail as a section: what happened, who did it, when.
// It is the outbox's own record, so the lines are the events a module
// published rather than a story this app invents.
import React from "react";
import { StyleSheet, View } from "react-native";
import { since, subject, verb, type Event } from "../../core/activity";
import { timeText } from "../../core/derive";
import { Badge } from "../atoms/Badge";
import { Icon } from "../atoms/Icon";
import { Text } from "../atoms/Text";
import { Section } from "../molecules/Section";
import { useStyles, type Theme } from "../theme";

export interface Props {
  readonly events: readonly Event[];
  /** names turns an actor's id into a person; an id nobody named stays an id. */
  readonly names: Readonly<Record<string, string>>;
  readonly loading: boolean;
  readonly error: string;
  /** full says the window filled, so older events exist that were not read. */
  readonly full: boolean;
  readonly now?: Date;
}

export function Activity({ events, names, loading, error, full, now = new Date() }: Props) {
  const s = useStyles(styles);

  if (error)
    return (
      <Section title="Activity">
        <Text tone="muted">{error}</Text>
      </Section>
    );
  if (loading && events.length === 0)
    return (
      <Section title="Activity">
        <Text tone="muted">Reading the trail…</Text>
      </Section>
    );
  if (events.length === 0)
    return (
      <Section
        title="Activity"
        {...(full ? { footer: "Only the most recent changes are read." } : {})}
      >
        <Text tone="muted">
          {full ? "Nothing recent about this record." : "Nothing has happened to this record yet."}
        </Text>
      </Section>
    );

  return (
    <Section
      title="Activity"
      {...(full ? { footer: "Only the most recent changes are read." } : {})}
    >
      {events.map((e) => {
        const who = e.actor ? (names[e.actor] ?? e.actor.slice(0, 8)) : "the system";
        const at = new Date(e.occurredAt);
        return (
          <View
            key={e.id}
            style={s.line}
            accessible
            accessibilityLabel={`${verb(e)} by ${who}, ${since(at, now, timeText)}`}
          >
            <Badge label={verb(e)} tone="info" />
            <View style={s.who}>
              <Text role="caption" tone="muted" numberOfLines={1}>
                {who}
              </Text>
              <View style={s.when}>
                <Icon name="clock" size="sm" tone="muted" />
                <Text role="caption" tone="muted">
                  {since(at, now, timeText)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </Section>
  );
}

/** subjectOf is exported for a trail that is not about one record; the detail screen does not use it. */
export { subject as subjectOf };

const styles = (t: Theme) =>
  StyleSheet.create({
    line: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.space.sm,
      paddingVertical: t.space.sm,
    },
    who: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.space.sm,
    },
    when: { flexDirection: "row", alignItems: "center", gap: t.space.xs },
  });
