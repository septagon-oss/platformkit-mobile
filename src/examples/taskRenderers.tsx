// taskRenderers is the kit's one example of a module-owned native screen, kept
// in src/examples and composed by no route. It is the pattern a product copies,
// not product UI: the kernel's own `task/task` record, drawn from the typed body
// of the operation that answers that key.
//
// What makes this screen worth writing at all is the SLA line. Everything else
// on it — the title, the priority, the lifecycle state — is a column the schema
// already describes, and the generated screens draw those from the catalogue
// alone. The deadline is two typed fields read together, `slaDeadline` and
// `slaBreached`, and no column can say what their pair says, because the server
// answers whether the deadline was missed and the phone formats when it was.
// That is the whole test for a custom screen: a workflow the resource schema
// cannot express.
//
// The one declaration below names the key, the read and the screen. The key is
// checked against the pinned document, the read against the key, and every field
// this screen draws against what that read answers, so nothing here can drift from
// the server without a compile error. `app/_layout.tsx` passes `defaultRenderers`,
// so nothing in this app renders it, and no server has to have the key.
import { Stack } from "expo-router";
import React, { useMemo } from "react";
import { View } from "react-native";
import {
  timeText,
  type Feedback,
  type Motion,
  type Present,
  type Presented,
} from "../core/present";
import { definePack, type ReadProps } from "../pack";
import type { OperationData, OperationName } from "../renderers";
import { Badge } from "../ui/atoms/Badge";
import { Notice, retry } from "../ui/atoms/Notice";
import { Spinner } from "../ui/atoms/Spinner";
import { Text } from "../ui/atoms/Text";
import { DetailRow } from "../ui/molecules/DetailRow";
import { Section } from "../ui/molecules/Section";
import { Actions } from "../ui/organisms/Actions";
import { kitStyles } from "../ui/layout";
import { Screen } from "../ui/templates/Screen";
import { useStyles } from "../ui/theme";

/** Task is what the pinned document answers `taskTaskRead` with. */
type Task = OperationData<"taskTaskRead">;

function TaskDetail({ read, present, feedback, actions }: ReadProps<Task>) {
  const task = read.data;
  // The header takes the typed row's own title, which is the simplest thing a
  // typed body buys: `task.title` is the document's `title`, and a field it does
  // not print is a compile error, not a blank line weeks later.
  const options = useMemo(
    () => ({ title: task?.title ?? "", headerLargeTitleEnabled: false }),
    [task?.title],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <Screen testID="task-detail">
        {read.error ? (
          <Notice announcement="urgent" text={read.error} action={retry(feedback, read.reload)} />
        ) : null}
        {read.requested && task === undefined ? (
          <Spinner label={feedback.loadingLabel} motion={feedback.motion} size="large" fill />
        ) : null}
        {task ? (
          <>
            <Section>
              <DetailRow testID="task-title" {...row(present("title", task.title))} />
              {task.description ? (
                <DetailRow
                  testID="task-description"
                  {...row(present("description", task.description))}
                />
              ) : null}
              {task.priority ? (
                <DetailRow
                  testID="task-priority"
                  {...pill(present("priority", task.priority), feedback.motion)}
                />
              ) : null}
              {task.status ? (
                <DetailRow
                  testID="task-status"
                  {...pill(present("status", task.status), feedback.motion)}
                />
              ) : null}
            </Section>
            {task.slaDeadline ? (
              <SlaLine
                deadline={task.slaDeadline}
                breached={task.slaBreached === true}
                feedback={feedback}
                present={present}
              />
            ) : null}
          </>
        ) : null}
        <Actions commands={actions.commands} running={actions.busy} onRun={actions.run} />
      </Screen>
    </>
  );
}

/** row is one presented field as a detail row's two props: the field's word for itself, and its value. */
const row = (presented: Presented): { readonly term: string; readonly value: string } => ({
  term: presented.label,
  value: presented.value,
});

/** pill is a closed-set value as the policy reads it: the same words on the row and on the pill. */
const pill = (presented: Presented, motion: Motion) => ({
  ...row(presented),
  shown: <Badge label={presented.value} tone={presented.tone} motion={motion} />,
});

/**
 * SlaLine is the reason this screen exists: the deadline in the device's own
 * zone, and the server's judgement beside it. The breach is drawn as the server
 * answered it — `slaBreached` is its fact, measured against its own clock — and
 * the phone adds no countdown of its own, because a second clock would only
 * disagree with the one that decides.
 */
function SlaLine({
  deadline,
  breached,
  feedback,
  present,
}: {
  readonly deadline: string;
  readonly breached: boolean;
  readonly feedback: Feedback;
  readonly present: Present;
}) {
  const s = useStyles(kitStyles);
  const shown = timeText(new Date(deadline), feedback);
  const field = present("slaDeadline", deadline);
  return (
    <Section>
      <DetailRow
        testID="task-sla"
        term={field.label}
        value={shown}
        shown={
          <View style={s.row}>
            <Text>{shown}</Text>
            {breached ? (
              <Badge
                label={present("slaBreached", true).label}
                tone="danger"
                symbol="warning"
                motion={feedback.motion}
              />
            ) : null}
          </View>
        }
      />
    </Section>
  );
}

/**
 * taskPack is the pack: one key the pinned document answers a read of, the read
 * that answers it, and one screen. The list, form and command screens stay
 * generated, because the schema derives them well and this screen would only be a
 * second implementation of them.
 */
export const taskPack = definePack({
  key: "task/task",
  read: "taskTaskRead",
  // A detail screen with no id has no row to ask about, and asking anyway would be a
  // read of the whole collection dressed up as one row.
  input: ({ id }) => (id === undefined ? undefined : { path: { id } }),
  detail: TaskDetail,
});

/**
 * taskRenderers is the same pack in the shape a plain `Renderers` record takes.
 *
 * @deprecated Declare the pack with `definePack` and spread its result into the
 * `renderers` passed to `<Shell>`; this name is the pack's key looked up by hand,
 * which is what a server-printed `renderer.name` still reaches during the
 * compatibility window.
 */
export const taskRenderers = taskPack["task/task"];

/**
 * typeProof is this pack's compile-time half, checked by `npm run typecheck` and
 * by nothing else: both lines must fail, which is what `@ts-expect-error`
 * asserts. They are here, in a file the project compiles, rather than in a
 * scratch file, because the assertion is only worth what the gate runs. If the
 * pin ever grows the field or the operation, `tsc` refuses this file — and the
 * refusal is the news, not the line.
 */
export function typeProof(task: Task): [string, OperationName] {
  // @ts-expect-error the pinned document names no field of that name on what the read answers
  const written: string = task.slaBreachedPerhaps;
  // @ts-expect-error the pinned document names no operation of that name
  const named: OperationName = "taskTaskNoSuchOperation";
  return [written, named];
}
