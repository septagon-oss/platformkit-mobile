// Home is what there is: the person is greeted, the workspace is named, what the
// installation answers about the counts stands under them, and one row per resource the
// caller may reach leads into the app. The address and the account say whose workspace
// these rows belong to; Refresh is pulling the list, and the account menu is in the
// native header, set by the screen composition. What this phone is holding to the
// person is above the counts, because it is the first thing a phone that lost its
// network owes an answer to.
import React, { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { Entry } from "../../core/catalog";
import { noun, homeMedia, type AvatarModel, type Feedback } from "../../core/derive";
import type { HeldWriteView } from "../../core/outbox";
import { recentKey, type RecentDoor } from "../../core/recents";
import type { StatCardModel } from "../../core/summary";
import { EmptyState } from "../atoms/EmptyState";
import { Text } from "../atoms/Text";
import { Avatar } from "../molecules/Avatar";
import { RowMedia } from "../molecules/RowMedia";
import type { ImageRenderer } from "../molecules/MediaHero";
import { Row } from "../molecules/Row";
import { Section } from "../molecules/Section";
import { StatCard } from "../molecules/StatCard";
import { HeldWriteRow } from "../molecules/HeldWriteRow";
import { testable } from "../props";
import { ListScreen } from "../templates/ListScreen";
import { useStyles, useTheme, type Theme } from "../theme";

export interface Props {
  readonly feedback: Feedback;
  readonly entries: readonly Entry[];
  readonly refreshing: boolean;
  /** account is the address the person signs in as, read under the workspace's name. */
  readonly account?: string | undefined;
  readonly person?: AvatarModel | undefined;
  readonly renderImage?: ImageRenderer | undefined;
  /**
   * greeting is Home's first sentence, already said in the reader's language, and
   * workspace the name of the place these records live. Both are drawn whatever the
   * rest of the page was answered with: a person is greeted before anything is counted.
   */
  readonly greeting: string;
  readonly workspace: string;
  /**
   * mark is the workspace's own image, built by the composition that owns an image view and
   * drawn beside the line that names the place. Absent — or a mark that never arrived — is
   * no image: the greeting and the name are said either way.
   */
  readonly mark?: ReactNode;
  /**
   * cards are the counts the installation answered, and counts the rows of the same
   * resource. Absent is absence: an empty list draws no cards and no numbers, which is
   * what a body that never answered, or a read that was refused, looks like — never a
   * zero the phone wrote itself.
   */
  readonly cards: readonly StatCardModel[];
  readonly counts: Readonly<Record<string, string>>;
  /**
   * recents are the records this device remembers this person opened, newest first. They
   * are absent — not empty — where the phone keeps no list at all, which is a build with no
   * store; an empty list is a person who has opened nothing, and neither draws a section.
   */
  readonly recents?: readonly RecentDoor[] | undefined;
  readonly onOpen: (entry: Entry) => void;
  /** onOpenRecent opens one remembered record. Where it is not supplied, a row is not drawn. */
  readonly onOpenRecent?: ((door: RecentDoor) => void) | undefined;
  readonly onRefresh: () => void;
  /** held is every write this phone still holds, in the order it was made. */
  readonly held: readonly HeldWriteView[];
  readonly onRetryHeld: (id: string) => void;
  readonly onDiscardHeld: (id: string) => void;
}

export function Home({
  feedback,
  entries,
  refreshing,
  account,
  person,
  renderImage,
  greeting,
  workspace,
  mark,
  cards,
  counts,
  recents,
  onOpen,
  onOpenRecent,
  onRefresh,
  held,
  onRetryHeld,
  onDiscardHeld,
}: Props) {
  const s = useStyles(styles);
  const t = useTheme();
  // One header, whoever is signed in: the greeting first, then the person's own unsent
  // work, then the address it belongs to, then what the counts body answered.
  const accountLine = person ? (
    <Avatar model={person} renderImage={renderImage} />
  ) : account ? (
    <Text tone="muted">{account}</Text>
  ) : null;
  const band = (
    <View style={s.band} {...testable("home-greeting")}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="homeBand" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.surface.band} />
            <Stop offset="1" stopColor={t.color.surfaceCanvas} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeBand)" />
      </Svg>
      <Text role="title" numberOfLines={1}>
        {greeting}
      </Text>
      <View style={s.named}>
        {mark ? (
          <View style={s.mark} {...testable("home-workspace-mark")}>
            {mark}
          </View>
        ) : null}
        <Text role="caption" tone="muted" numberOfLines={1} testID="home-workspace">
          {workspace}
        </Text>
      </View>
    </View>
  );
  const header = (
    <>
      {band}
      {held.length === 0 ? (
        accountLine
      ) : (
        <>
          <Section title={feedback.copy.state.held.title}>
            {held.map((view) => (
              <HeldWriteRow
                key={view.id}
                view={view}
                onRetry={onRetryHeld}
                onDiscard={onDiscardHeld}
              />
            ))}
          </Section>
          {accountLine}
        </>
      )}
      {cards.length === 0 ? null : (
        <View style={s.cards}>
          {cards.map((card) => (
            <StatCard
              key={card.key}
              stat={card.stat}
              {...(card.secondary === undefined ? {} : { secondary: card.secondary })}
              {...(card.spark === undefined ? {} : { spark: card.spark })}
              aloud={card.aloud}
              onPress={() => onOpen(card.target)}
              testID={`home-stat-${card.key.replace("/", "-")}`}
            />
          ))}
        </View>
      )}
      {recents === undefined || recents.length === 0 || !onOpenRecent ? null : (
        <Section title={feedback.copy.kit.recentlyOpened} testID="home-section-recent">
          {recents.map((door) => (
            <Row
              key={recentKey(door.recent)}
              title={door.recent.title}
              leading={<RowMedia model={homeMedia(door.entry)} />}
              onPress={() => onOpenRecent(door)}
              testID={`home-recent-${door.entry.module}-${door.entry.entity}-${door.recent.recordId}`}
            />
          ))}
        </Section>
      )}
    </>
  );
  return (
    <ListScreen
      feedback={feedback}
      data={entries}
      keyOf={(e) => `${e.module}/${e.entity}`}
      loading={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
      grouped
      groupTitle={feedback.copy.kit.allResources}
      groupTestID="home-section-resources"
      header={header}
      testID="home"
      render={(e) => {
        const count = counts[`${e.module}/${e.entity}`];
        return (
          <Row
            title={noun(e).plural}
            leading={<RowMedia model={homeMedia(e)} />}
            cells={e.writable ? [] : [{ value: feedback.copy.kit.readOnly }]}
            {...(count === undefined
              ? {}
              : {
                  trailing: (
                    <Text role="numeric" tone="muted" testID={`home-count-${e.module}-${e.entity}`}>
                      {count}
                    </Text>
                  ),
                })}
            onPress={() => onOpen(e)}
            testID={`open-${e.module}-${e.entity}`}
          />
        );
      }}
      empty={
        <EmptyState
          title="Nothing you may reach here yet"
          text="Ask an administrator for access, then pull to refresh."
        />
      }
    />
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    // The band is full-bleed: the negatives of the canvas inset, which is the only
    // spelling of "edge to edge" that leaves the length owned by scale.ts. It ends in
    // the canvas colour, where the first card begins, so no seam is painted.
    band: {
      gap: t.space.xs,
      padding: t.space.lg,
      paddingTop: t.space.xl,
      marginHorizontal: -t.space.lg,
      marginTop: -t.space.lg,
      minHeight: t.extent.statBand,
      justifyContent: "flex-end",
    },
    // Three cards need three widths and two gaps: 3·`extent.statCard` + 2·`space.sm` is 412,
    // wider than the canvas leaves on any phone (a 390-dp screen gives 358, and the kit's
    // widest page column 388). So the row wraps: two cards share the first line and a third
    // stands on the next one, each grown to its line. Narrowing `extent.statCard` until the
    // three fitted would trade a readable number for arithmetic, and a sideways scroll would
    // hide a count behind a gesture nobody offers on a page that already scrolls down.
    cards: { flexDirection: "row", flexWrap: "wrap", gap: t.space.sm },
    // The workspace's own mark sits beside the line that names the place, at the small
    // avatar's size: same height as the account row under it, so the page reads down one
    // column of faces.
    named: { flexDirection: "row", alignItems: "center", gap: t.space.xs },
    mark: {
      width: t.extent.avatarSmall,
      height: t.extent.avatarSmall,
      borderRadius: t.radius.full,
      overflow: "hidden",
      flexShrink: 0,
    },
  });
