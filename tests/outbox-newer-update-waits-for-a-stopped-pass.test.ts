import assert from "node:assert/strict";
import test from "node:test";
import { createApi } from "../src/effects/api";
import { createOutbox } from "../src/effects/outbox";
import { clock, fakeOutboxStore, mint } from "./fakes/store";

for (const failure of ["server unavailable", "network unreachable"] as const) {
  test(`retrying an older held update after ${failure} never overwrites a newer submission`, async () => {
    const pending = fakeOutboxStore();
    let reached = false;
    let olderBlocked = true;
    let titleOnServer = "Original stock";
    const landed: string[] = [];
    const api = createApi("https://warehouse.test", (async (_input, init) => {
      const { title } = JSON.parse(String(init?.body)) as { title: string };
      if (title === "Opening stock" && olderBlocked) {
        if (failure === "network unreachable") throw new TypeError("Network unreachable");
        return new Response(JSON.stringify({ detail: "Temporarily unavailable" }), {
          status: 503,
        });
      }
      landed.push(title);
      titleOnServer = title;
      return new Response(JSON.stringify({ id: "17", title }), { status: 200 });
    }) as typeof fetch);
    const outbox = createOutbox({
      store: pending.store,
      api,
      clock: clock(),
      mint: mint(),
      scope: () => ({ server: "https://warehouse.test", userId: "morgan" }),
      reached: () => reached,
    });
    const write = (title: string) => ({
      kind: "update" as const,
      resourceKey: "inventory/item",
      path: "/api/v1/inventory/items/17",
      body: { title },
    });

    const earlier = await outbox.submit(write("Opening stock"));
    assert.equal(earlier.sent, false);
    if (earlier.sent) return;
    reached = true;
    const later = await outbox.submit(write("Closing stock")).catch(() => undefined);
    await outbox.drain({ force: true });
    const held = await outbox.list();
    assert.equal(held.find((item) => item.id === earlier.item.id)?.state, "queued");

    // The older write is still queued after the failed pass. Retry becomes
    // possible once the server accepts it; it must land before the newer edit.
    olderBlocked = false;
    await outbox.retry(earlier.item.id);
    await outbox.drain({ force: true });
    // A submission refused before sending may be offered again after the
    // older write lands; a held submission must drain without resubmission.
    if (later === undefined) await outbox.submit(write("Closing stock"));
    await outbox.drain({ force: true });

    assert.deepEqual(
      { landed, titleOnServer, held: await outbox.list() },
      { landed: ["Opening stock", "Closing stock"], titleOnServer: "Closing stock", held: [] },
      "a stopped pass cannot let the newer edit land first and its earlier Retry land last",
    );
  });
}
