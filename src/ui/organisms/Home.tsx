// Home is what there is: one row per resource the caller may reach, in the one
// group of choices the app offers. The address and the account say whose workspace
// these rows belong to; Refresh is pulling the list, and the account menu is in the
// native header, set by the screen composition.
import React from "react";
import type { Entry } from "../../core/catalog";
import { noun, type Feedback } from "../../core/derive";
import { EmptyState } from "../atoms/EmptyState";
import { Text } from "../atoms/Text";
import { Row } from "../molecules/Row";
import { ListScreen } from "../templates/ListScreen";

export interface Props {
  readonly feedback: Feedback;
  readonly entries: readonly Entry[];
  readonly refreshing: boolean;
  /** account is the address the person signs in as, read under the workspace's name. */
  readonly account?: string | undefined;
  readonly onOpen: (entry: Entry) => void;
  readonly onRefresh: () => void;
}

export function Home({ feedback, entries, refreshing, account, onOpen, onRefresh }: Props) {
  return (
    <ListScreen
      feedback={feedback}
      data={entries}
      keyOf={(e) => `${e.module}/${e.entity}`}
      loading={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
      grouped
      header={account ? <Text tone="muted">{account}</Text> : undefined}
      testID="home"
      render={(e) => (
        <Row
          title={noun(e).plural}
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
