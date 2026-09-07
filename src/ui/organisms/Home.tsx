// Home is what there is: one row per resource the caller may reach, which is
// the web dashboard's cards without the counts. Refresh is pulling the list;
// the account menu is in the native header, set by the screen composition.
import React from "react";
import type { Entry } from "../../core/catalog";
import { humanize } from "../../core/derive";
import { EmptyState } from "../atoms/EmptyState";
import { Row } from "../molecules/Row";
import { Section } from "../molecules/Section";
import { ListScreen } from "../templates/ListScreen";

export interface Props {
  readonly entries: readonly Entry[];
  readonly refreshing: boolean;
  readonly onOpen: (entry: Entry) => void;
  readonly onRefresh: () => void;
}

export function Home({ entries, refreshing, onOpen, onRefresh }: Props) {
  return (
    <ListScreen
      data={entries}
      keyOf={(e) => `${e.module}/${e.entity}`}
      loading={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
      testID="home"
      render={(e) => (
        <Section>
          <Row
            title={humanize(e.entity) + "s"}
            cells={[`In ${e.module}${e.writable ? "" : ", read only"}`]}
            onPress={() => onOpen(e)}
            testID={`open-${e.module}-${e.entity}`}
          />
        </Section>
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
