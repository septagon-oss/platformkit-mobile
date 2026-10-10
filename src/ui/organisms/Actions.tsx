// Actions is what a record can be told to do beyond being edited: the
// lifecycle commands the catalog says this caller may run. Every one of them
// is a row titled in the API document's own words — its `presentation.label`, or
// its summary, or the verb spelled as words — because a screen that renamed them
// would be a second vocabulary to keep true, and because the sentence under the
// row is developer prose where a person is choosing an action (0085).
//
// A command that takes an argument opens a sheet; one that takes none asks and
// runs. That difference belongs to the screen, which is why both arrive here as
// the same callback — and it is the whole of what the chevron means, so only
// the first kind gets one.
import React from "react";
import type { Command } from "../../core/catalog";
import { commandTitle } from "../../core/derive";
import { Row } from "../molecules/Row";
import { Section } from "../molecules/Section";

export interface Props {
  readonly commands: readonly Command[];
  /** running is the verb under way, so its own row says so and none can be pressed twice. */
  readonly running: string;
  readonly onRun: (c: Command) => void;
}

export function Actions({ commands, running, onRun }: Props) {
  if (commands.length === 0) return null;
  return (
    <Section title="Actions">
      {commands.map((c) => (
        <Row
          key={c.verb}
          title={commandTitle(c)}
          busy={running === c.verb}
          opens={c.fields.length > 0}
          onPress={() => onRun(c)}
          testID={`command-${c.verb}`}
        />
      ))}
    </Section>
  );
}
