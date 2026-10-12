import assert from "node:assert/strict";
import test from "node:test";
import { heldWrite } from "../src/core/outbox";
import { createApi } from "../src/effects/api";
import { createOutbox } from "../src/effects/outbox";
import { clock, fakeOutboxStore, mint } from "./fakes/store";

test("retry waits for an older held update before sending the newer update to the same row", async () => {
  const pending = fakeOutboxStore();
  for (const [id, title] of [
    ["old", "First edit"],
    ["new", "Final edit"],
    ["discarded", "Unwanted edit"],
  ]) {
    pending.raw(
      heldWrite(
        {
          kind: "update",
          resourceKey: "note/note",
          path: "/api/v1/note/notes/7",
          body: { title },
        },
        id!,
        clock().now(),
      ),
    );
  }
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const completed = Promise.withResolvers<void>();
  const sent: string[] = [];
  let titleOnServer = "Original";
  const api = createApi("https://acme.test", (async (_input, init) => {
    const { title } = JSON.parse(String(init?.body)) as { title: string };
    sent.push(title);
    if (title === "First edit") {
      started.resolve();
      await release.promise;
    }
    titleOnServer = title;
    return new Response(JSON.stringify({ id: "7", title }), { status: 200 });
  }) as typeof fetch);
  const outbox = createOutbox({
    store: pending.store,
    api,
    clock: clock(),
    mint: mint(),
    scope: () => ({ server: "https://acme.test", userId: "ada" }),
    notice: () => {
      if (pending.rows.length === 0) completed.resolve();
    },
  });

  // Discard offers a background drain, exactly as the Home action does. While
  // its first PATCH is outstanding, Retry remains offered on the second row.
  await outbox.discard("discarded");
  await started.promise;
  const retry = outbox.retry("new");
  await new Promise<void>((resolve) => setImmediate(resolve));
  const beforeFirstAnswer = [...sent];
  release.resolve();
  await retry;
  await completed.promise;

  assert.deepEqual(
    { beforeFirstAnswer, titleOnServer },
    { beforeFirstAnswer: ["First edit"], titleOnServer: "Final edit" },
    "held updates stay serial even when the person presses Retry during a background drain",
  );
});
