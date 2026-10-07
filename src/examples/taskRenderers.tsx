// taskRenderers is the kit's one example of a module-owned native screen, kept
// in src/examples and composed by no route. It is the pattern a product copies,
// not product UI: the kernel's own `task/tasks` record, drawn from the typed
// body of a generated operation.
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
// It is reached by a catalogue entry naming `"renderer": {"name":
// "task/tasks", "min_shell": 1}`; `app/_layout.tsx` passes `defaultRenderers`,
// so nothing in this app renders it, and no server has to have the key.
import { Stack } from "expo-router";
import React, { useMemo } from "react";
import { View } from "react-native";
import { humanize, rowCommands, timeText, type Feedback } from "../core/derive";
import type { OperationData, OperationName, Renderer, ScreenProps } from "../renderers";
import { useCommandRun } from "../screens/useCommand";
import { useFeedback } from "../screens/useFeedback";
import { useOperation } from "../screens/useOperation";
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

function TaskDetail({ entry, id }: ScreenProps) {
  const feedback = useFeedback();
  // The read is named, not fetched: `id` of undefined means there is no row to
  // ask about yet, and asking would be a request the screen has no subject for.
  const read = useOperation("taskTaskRead", id === undefined ? undefined : { path: { id } });
  const task = read.data;
  const { run, busy } = useCommandRun(entry, id);
  const commands = rowCommands(entry);
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
              <DetailRow testID="task-title" term={humanize("title")} value={task.title} />
              {task.description ? (
                <DetailRow
                  testID="task-description"
                  term={humanize("description")}
                  value={task.description}
                />
              ) : null}
              {task.priority ? (
                <DetailRow
                  testID="task-priority"
                  term={humanize("priority")}
                  value={humanize(task.priority)}
                  shown={<Badge label={humanize(task.priority)} />}
                />
              ) : null}
              {task.status ? (
                <DetailRow
                  testID="task-status"
                  term={humanize("status")}
                  value={humanize(task.status)}
                  shown={<Badge label={humanize(task.status)} />}
                />
              ) : null}
            </Section>
            {task.slaDeadline ? (
              <SlaLine deadline={task.slaDeadline} task={task} feedback={feedback} />
            ) : null}
          </>
        ) : null}
        <Actions commands={commands} running={busy} onRun={run} />
      </Screen>
    </>
  );
}

/**
 * SlaLine is the reason this screen exists: the deadline in the device's own
 * zone, and the server's judgement beside it. The breach is drawn as the server
 * answered it — `slaBreached` is its fact, measured against its own clock — and
 * the phone adds no countdown of its own, because a second clock would only
 * disagree with the one that decides.
 */
function SlaLine({
  deadline,
  task,
  feedback,
}: {
  readonly deadline: string;
  readonly task: Task;
  readonly feedback: Feedback;
}) {
  const s = useStyles(kitStyles);
  const breached = task.slaBreached === true;
  const shown = timeText(new Date(deadline), feedback);
  return (
    <Section>
      <DetailRow
        testID="task-sla"
        term={humanize("slaDeadline")}
        value={shown}
        shown={
          <View style={s.row}>
            <Text>{shown}</Text>
            {breached ? (
              <Badge label={humanize("slaBreached")} tone="danger" symbol="warning" />
            ) : null}
          </View>
        }
      />
    </Section>
  );
}

/**
 * taskRenderers is the pack. One kind, `detail`: the list, form and command
 * screens stay generated, because the schema derives them well and this screen
 * would only be a second implementation of them.
 */
export const taskRenderers: Renderer = { detail: TaskDetail };

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
