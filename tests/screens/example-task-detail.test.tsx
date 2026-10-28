// The example pack is the pattern a product copies, so what is proved here is the
// pattern's two halves: a screen whose data arrives as the operation's own
// response type and is drawn because it has the shape the document described; and
// a refusal — a body outside that type — drawn as the refusal, with no row of the
// schema the server failed. Between them sits the read itself: one question per
// subject, one answer per question, and nothing set after the screen is gone.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { parseCatalog, type Catalog, type Entry } from "../../src/core/catalog";
import { entryReads } from "../../src/generated/entries.gen";
import { definePack } from "../../src/pack";
import { taskPack } from "../../src/examples/taskRenderers";
import { ResourceRoute } from "../../src/route";
import { useOperation } from "../../src/screens/useOperation";
import { ThemeProvider } from "../../src/ui/theme";
import { reset, setParams } from "../fakes/router";
import { taskBlock } from "../fakes/policy";
import { answering, fakeApi, operationsFrom, recorded, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

/**
 * taskCatalog is a catalogue document for the kernel's own `task/task` record with no
 * `renderer` block at all: the pack is reached by the key its own declaration carries,
 * which is `module/entity`, which is what the entry's key already is. The pinned
 * fixture carries no `renderer` — the kernel owns that key and has not printed it.
 */
function taskCatalog(resolved?: unknown): Catalog {
  return parseCatalog({
    catalogVersion: 3,
    resources: [
      {
        module: "task",
        entity: "task",
        path: "/api/v1/task/tasks",
        writable: true,
        fields: [
          { name: "id", type: "uuid", readOnly: true },
          { name: "title", type: "string" },
          { name: "description", type: "text" },
          { name: "priority", type: "string", enum: ["low", "normal", "high", "critical"] },
          { name: "status", type: "string", enum: ["open", "resolved"] },
          { name: "slaDeadline", type: "time", readOnly: true },
          { name: "slaBreached", type: "bool", readOnly: true },
        ],
        commands: [
          { verb: "publish", summary: "Publish the task" },
          { verb: "archive", summary: "Archive the task" },
        ],
        ...(resolved === undefined ? {} : { resolved }),
      },
    ],
  });
}

const task = {
  id: "task-1041",
  title: "Re-key the loading bay",
  description: "The barrier has been stuck since Monday.",
  priority: "high",
  status: "open",
  slaDeadline: "2026-03-14T09:00:00Z",
  slaBreached: true,
};

/** shellOver is a signed-in shell holding the example pack and the Api the test named. */
function shellOver(api: ReturnType<typeof fakeApi>, resolved?: unknown): void {
  const catalog = taskCatalog(resolved);
  shell.value = shellValue(api, {
    state: { phase: "ready", generation: 1, catalog },
    renderers: { ...taskPack },
    entry: (module, entity) =>
      catalog.resources.find((r) => r.module === module && r.entity === entity) as Entry,
  });
}

const detail = () => (
  <ThemeProvider mode="light">
    <ResourceRoute kind="detail" withID />
  </ThemeProvider>
);

beforeEach(() => {
  reset();
  setParams({ module: "task", entity: "task", id: "task-1041" });
});

describe("the example renderer pack's detail", () => {
  test("draws the typed body the operation answered and the entry's own commands", async () => {
    shellOver(fakeApi(answering(task)));
    await render(detail());
    expect(await screen.findByTestId("task-detail")).toBeOnTheScreen();
    expect(screen.getByTestId("task-title")).toHaveTextContent(/Re-key the loading bay/);
    expect(screen.getByTestId("task-priority")).toHaveTextContent(/High/);
    expect(screen.getByTestId("task-status")).toHaveTextContent(/Open/);
    // The line no column can be: the deadline in the device's own zone with the
    // server's own judgement that it slipped.
    expect(screen.getByTestId("task-sla")).toHaveTextContent(/Sla deadline/);
    expect(screen.getByTestId("task-sla")).toHaveTextContent(/Sla breached/);
    // And the lifecycle commands stay the catalogue's, drawn by the same organism
    // with the verbs the document printed.
    expect(screen.getByTestId("command-publish")).toBeOnTheScreen();
    expect(screen.getByTestId("command-archive")).toBeOnTheScreen();
  });

  test("a body outside the operation's schema is drawn as the refusal and no row", async () => {
    // `priority: 9` is outside the document's union, so that one operation's
    // generated validator refuses the answer before the screen sees a field.
    shellOver(fakeApi(answering({ id: "task-1041", title: "Re-key", priority: 9 })));
    await render(detail());
    // A body this build cannot read is not a path to read out: it is one sentence.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Update the app to open this workspace.",
    );
    for (const drawn of ["task-title", "task-priority", "task-status", "task-sla"])
      expect(screen.queryByTestId(drawn)).toBeNull();
  });

  test("a read under way draws the wait and no row of a body not yet answered", async () => {
    const owed = Promise.withResolvers<Response>();
    shellOver(fakeApi(operationsFrom(async () => owed.promise)));
    await render(detail());
    expect(await screen.findByRole("progressbar")).toBeOnTheScreen();
    for (const drawn of ["task-title", "task-priority", "task-status", "task-sla"])
      expect(screen.queryByTestId(drawn)).toBeNull();
    owed.resolve(new Response("{}", { status: 500 }));
    await act(async () => {
      await owed.promise.catch(() => undefined);
    });
  });

  test("a refusal the server answers with draws one sentence, withdraws the row, and asks again when pressed", async () => {
    const read = recorded(task, 500);
    shellOver(fakeApi(read.operations));
    await render(detail());
    expect(await screen.findByRole("alert")).toBeOnTheScreen();
    expect(screen.queryByTestId("task-title")).toBeNull();
    expect(read.calls).toEqual(["https://fake.test/api/v1/task/tasks/task-1041"]);
    // The way back out is the same question, asked again honestly.
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(read.calls).toHaveLength(2));
    expect(read.calls[1]).toEqual(read.calls[0]);
  });

  test("a person reads the words and the shade the server resolved for this entry", async () => {
    shellOver(fakeApi(answering(task)), taskBlock());
    await render(detail());
    // The resolved word, not `humanize`: "Estado" for the field and "Em aberto" for the value.
    expect(await screen.findByTestId("task-status")).toHaveTextContent(/Estado/);
    expect(screen.getByTestId("task-status")).toHaveTextContent(/Em aberto/);
    expect(screen.getByTestId("task-status")).not.toHaveTextContent(/Open/);
    // The tone is the policy's too: the pill of a value the policy shades differs
    // from the pill of one it leaves plain, which no `humanize` call could produce.
    expect(worn("Em aberto")).not.toEqual(worn("High"));
  });

  test("a value the policy leaves unlabelled keeps today's words and no shade", async () => {
    shellOver(fakeApi(answering({ ...task, status: "resolved" })), taskBlock());
    await render(detail());
    expect(await screen.findByTestId("task-status")).toHaveTextContent(/Resolved/);
    // No shade, so the same pair as the other unshaded pill on the page.
    expect(worn("Resolved")).toEqual(worn("High"));
  });

  test("a pack key the document answers nothing for is refused by the map that answers the rest", () => {
    // @ts-expect-error a key spelled past the document's keys answers no read of anything
    definePack({ key: "task/taskz", read: "taskTaskRead", input: () => undefined });
    // @ts-expect-error a read of another key answers a screen of this one nothing
    definePack({ key: "task/task", read: "userUserRead", input: () => undefined });
    // @ts-expect-error a write is a receipt, not a body a screen draws
    definePack({ key: "task/task", read: "taskTaskCreate", input: () => undefined });
    // @ts-expect-error the golden catalogue's own module is outside the public document
    definePack({ key: "note/note", read: "taskTaskRead", input: () => undefined });
    // What those four rest on, read rather than asserted by the compiler alone.
    expect(entryReads["task/task"]).toContain("taskTaskRead");
    expect(entryReads["task/task"]).not.toContain("userUserRead");
    expect(entryReads["task/task"]).not.toContain("taskTaskCreate");
    expect("note/note" in entryReads).toBe(false);
  });
});

/** worn is the background colour of the first pill at or above these words: the tone as it reaches a screen. */
function worn(words: string): string {
  for (let node = screen.getByText(words).parent; node; node = node.parent) {
    const style = node.props.style;
    for (const layer of Array.isArray(style) ? style : [style]) {
      const colour = (layer as { backgroundColor?: unknown } | undefined)?.backgroundColor;
      if (typeof colour === "string") return colour;
    }
  }
  throw new Error(`nothing above ${JSON.stringify(words)} wears a colour`);
}

describe("useOperation", () => {
  test("an input of undefined asks for nothing at all", async () => {
    const read = recorded(task);
    shellOver(fakeApi(read.operations));
    const { result } = await renderHook(() => useOperation("taskTaskRead", undefined));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.requested).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBe("");
    expect(read.calls).toEqual([]);
  });

  test("the same question asked again by a re-render is read once", async () => {
    const read = recorded(task);
    shellOver(fakeApi(read.operations));
    const { rerender, result } = await renderHook(() =>
      // A fresh object literal every render is the same question; asking by
      // object identity here would be a request per render.
      useOperation("taskTaskRead", { path: { id: "task-1041" } }),
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    await rerender(undefined);
    await act(async () => {
      await Promise.resolve();
    });
    expect(read.calls).toEqual(["https://fake.test/api/v1/task/tasks/task-1041"]);
    expect(result.current.requested).toBe(false);
  });

  test("a new subject is a new read, and a late answer to the old one is discarded", async () => {
    const late = Promise.withResolvers<Response>();
    const soon = Promise.withResolvers<Response>();
    const answers = [late.promise, soon.promise];
    const asked: string[] = [];
    shellOver(
      fakeApi(
        operationsFrom(async (input) => {
          asked.push(String(input instanceof Request ? input.url : input));
          return answers.shift() ?? soon.promise;
        }),
      ),
    );
    const { rerender, result } = await renderHook(() =>
      useOperation("taskTaskRead", { path: { id: asked.length ? "task-2026" : "task-1041" } }),
    );
    await waitFor(() => expect(asked).toEqual(["https://fake.test/api/v1/task/tasks/task-1041"]));
    // A second question while the first is still owed.
    await rerender(undefined);
    await waitFor(() => expect(asked.length).toBe(2));
    soon.resolve(response({ ...task, title: "The newer answer" }));
    await waitFor(() => expect(result.current.data?.title).toBe("The newer answer"));
    // The first answer arrives last. It belongs to a question no screen is asking.
    late.resolve(response({ ...task, title: "The stale answer" }));
    await act(async () => {
      await late.promise;
    });
    expect(result.current.data?.title).toBe("The newer answer");
    expect(result.current.error).toBe("");
  });

  test("a refusal carries the verdict behind its sentence, and an answer carries none", async () => {
    const refused = recorded(task, 500);
    shellOver(fakeApi(refused.operations));
    const { result } = await renderHook(() =>
      useOperation("taskTaskRead", { path: { id: "task-1041" } }),
    );
    await waitFor(() => expect(result.current.error).not.toBe(""));
    expect(result.current.data).toBeUndefined();
    // The sentence is what a person reads; the verdict is what a screen draws the
    // sentence for and what it lets the person do next.
    expect(result.current.failure?.outcome).toBe("notice");
    const answered = recorded(task);
    shellOver(fakeApi(answered.operations));
    const read = await renderHook(() =>
      useOperation("taskTaskRead", { path: { id: "task-1041" } }),
    );
    await waitFor(() => expect(read.result.current.data).toBeDefined());
    expect(read.result.current.failure).toBeUndefined();
  });

  test("a refusal that arrives after the screen left sets nothing and warns nothing", async () => {
    // The refusal is owed by the transport and released after the screen is
    // gone, so the whole documented path — route table, status check, ApiError —
    // is what settles into nothing.
    const owed = Promise.withResolvers<Response>();
    shellOver(fakeApi(operationsFrom(async () => owed.promise)));
    const warn = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { result, unmount } = await renderHook(() =>
      useOperation("taskTaskRead", { path: { id: "task-1041" } }),
    );
    await waitFor(() => expect(result.current.requested).toBe(true));
    await unmount();
    owed.resolve(response({ id: "task-1041", title: "Late", priority: "normal" }, 500));
    await act(async () => {
      await owed.promise.catch(() => undefined);
      await Promise.resolve();
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
