// Home is what there is: one row per resource the caller may reach, in the one
// group of choices the app offers. The address and the account say whose workspace
// these rows belong to; Refresh is pulling the list, and the account menu is in the
// native header, set by the screen composition. What this phone is holding to the
// person is above those rows, because it is the first thing a phone that lost its
// network owes an answer to.
import React from "react";
import type { Entry } from "../../core/catalog";
import { noun, homeMedia, type AvatarModel, type Feedback } from "../../core/derive";
import type { HeldWriteView } from "../../core/outbox";
import { EmptyState } from "../atoms/EmptyState";
import { Text } from "../atoms/Text";
import { Avatar } from "../molecules/Avatar";
import { RowMedia } from "../molecules/RowMedia";
import type { ImageRenderer } from "../molecules/MediaHero";
import { Row } from "../molecules/Row";
import { Section } from "../molecules/Section";
import { HeldWriteRow } from "../molecules/HeldWriteRow";
import { ListScreen } from "../templates/ListScreen";

export interface Props {
  readonly feedback: Feedback;
  readonly entries: readonly Entry[];
  readonly refreshing: boolean;
  /** account is the address the person signs in as, read under the workspace's name. */
  readonly account?: string | undefined;
  readonly person?: AvatarModel | undefined;
  readonly renderImage?: ImageRenderer | undefined;
  readonly onOpen: (entry: Entry) => void;
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
  onOpen,
  onRefresh,
  held,
  onRetryHeld,
  onDiscardHeld,
}: Props) {
  // One header, whoever is signed in: the person's own unsent work first, then the
  // address it belongs to. A phone with nothing held and no account named has no
  // header at all, which is the screen as it was before either had anything to say.
  const accountLine = person ? (
    <Avatar model={person} renderImage={renderImage} />
  ) : account ? (
    <Text tone="muted">{account}</Text>
  ) : null;
  const header =
    held.length === 0 && account === undefined && !person ? undefined : held.length === 0 ? (
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
      header={header}
      testID="home"
      render={(e) => (
        <Row
          title={noun(e).plural}
          leading={<RowMedia model={homeMedia(e)} />}
          cells={e.writable ? [] : [{ value: feedback.copy.kit.readOnly }]}
          onPress={() => onOpen(e)}
          testID={`open-${e.module}-${e.entity}`}
        />
      )}
      empty={
        <EmptyState
          title="Nothing you may reach here yet"
          text="Ask an administrator for access, then pull to refresh."
        />
      }
    />
  );
}
