import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { ApiError, createApi } from "../src/effects/api";

function empty(value: unknown): undefined {
  assert.equal(value, undefined);
  return undefined;
}

function notes(value: unknown): unknown[] {
  assert.ok(Array.isArray(value));
  return value;
}

function savedNote(value: unknown): {
  note: { id: string; status: string };
  revisions: { number: number }[];
} {
  assert.ok(value && typeof value === "object" && "note" in value && "revisions" in value);
  const { note, revisions } = value;
  assert.ok(note && typeof note === "object" && "id" in note && "status" in note);
  assert.equal(typeof note.id, "string");
  assert.equal(typeof note.status, "string");
  assert.ok(Array.isArray(revisions));
  return {
    note: { id: String(note.id), status: String(note.status) },
    revisions: revisions.map((revision: unknown) => {
      assert.ok(revision && typeof revision === "object" && "number" in revision);
      assert.equal(typeof revision.number, "number");
      return { number: Number(revision.number) };
    }),
  };
}

test("a custom write with a lost response is recovered through its persisted read without replay", async (t) => {
  const received: { method: string; path: string; cookie: string | undefined; body: string }[] = [];
  const saved = { note: { id: "7", status: "published" }, revisions: [{ number: 1 }] };
  let committed = false;
  const server = createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      received.push({ method: req.method!, path: req.url!, cookie: req.headers.cookie, body });
      if (req.method === "POST") {
        committed = true;
        res.destroy();
      } else {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(committed ? saved : { note: { id: "7", status: "draft" } }));
      }
    });
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const api = createApi(`http://127.0.0.1:${address.port}`, fetch, "platformkit_session=fixture");
  await assert.rejects(
    api.request("POST", "/api/v1/note/me/notes/7/publish", savedNote, { reason: "Ready" }),
  );
  assert.equal(committed, true);
  assert.deepEqual(
    await api.request("GET", "/api/v1/note/me/notes/7?revision=latest", savedNote),
    saved,
  );
  assert.deepEqual(received, [
    {
      method: "POST",
      path: "/api/v1/note/me/notes/7/publish",
      cookie: "platformkit_session=fixture",
      body: '{"reason":"Ready"}',
    },
    {
      method: "GET",
      path: "/api/v1/note/me/notes/7?revision=latest",
      cookie: "platformkit_session=fixture",
      body: "",
    },
  ]);
});

test("custom requests share problem decoding and accept empty successful responses", async () => {
  const responses = [
    new Response(
      JSON.stringify({
        detail: "crud: invalid: a reason is required",
        errors: ["reason: is required"],
      }),
      { status: 422 },
    ),
    new Response(null, { status: 204 }),
  ];
  const calls: RequestInit[] = [];
  const api = createApi("https://example.test", (async (_url, init) => {
    calls.push(init!);
    return responses.shift()!;
  }) as typeof fetch);
  await assert.rejects(
    api.request("POST", "/api/v1/note/me/notes/7/publish", savedNote, {}),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 422);
      assert.equal(error.detail, "a reason is required");
      assert.deepEqual(error.fields, { reason: "is required" });
      return true;
    },
  );
  assert.equal(await api.request("POST", "/api/v1/note/me/notes/7/archive", empty), undefined);
  assert.equal(calls[1]!.body, undefined);
  assert.equal((calls[1]!.headers as Record<string, string>)["Content-Type"], undefined);
});

test("custom paths cannot replace the server or escape the API path", async () => {
  let called = false;
  const api = createApi(
    "https://example.test",
    (async () => {
      called = true;
      return new Response("{}");
    }) as typeof fetch,
    "platformkit_session=fixture",
  );
  for (const path of [
    "https://elsewhere.test/api/v1/notes",
    "//elsewhere.test/api/v1/notes",
    "/admin",
    "/api/v1/../auth",
    "/api/v1/%2e%2e/auth",
    "/api/v1/notes#section",
    "/api/v1/notes\\other",
  ]) {
    await assert.rejects(api.request("GET", path, notes), /API path/);
  }
  await assert.rejects(api.request("GET", "/api/v1/notes", notes, { title: "No GET body" }), /GET/);
  assert.equal(called, false);
});

test("an already cancelled request never reaches the transport", async () => {
  let called = false;
  const api = createApi("https://example.test", (async () => {
    called = true;
    return new Response("{}");
  }) as typeof fetch);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    api.request("GET", "/api/v1/note/me/notes", notes, undefined, { signal: controller.signal }),
    {
      name: "AbortError",
    },
  );
  assert.equal(called, false);
});

test("cancellation during a body read stays distinct from the deadline", async () => {
  const reading = Promise.withResolvers<void>();
  let receivedSignal: AbortSignal | undefined;
  const api = createApi(
    "https://example.test",
    (async (_url, init) => {
      receivedSignal = init!.signal!;
      return {
        status: 200,
        headers: new Headers(),
        text: () =>
          new Promise<string>((_resolve, reject) => {
            receivedSignal!.addEventListener(
              "abort",
              () => reject(new Error("transport aborted")),
              { once: true },
            );
            reading.resolve();
          }),
      };
    }) as typeof fetch,
    undefined,
    1000,
  );
  const controller = new AbortController();
  const pending = api.request("GET", "/api/v1/note/me/notes", notes, undefined, {
    signal: controller.signal,
  });
  await reading.promise;
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(receivedSignal?.aborted, true);
});

test("custom requests retain the deadline and do not retry failures", async () => {
  let calls = 0;
  const api = createApi(
    "https://example.test",
    ((_url, init) => {
      calls++;
      return new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () => reject(new Error("transport aborted")), {
          once: true,
        });
      });
    }) as typeof fetch,
    undefined,
    20,
  );
  await assert.rejects(
    api.request("POST", "/api/v1/note/me/notes/7/publish", savedNote),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 0);
      assert.match(error.detail, /did not answer within/);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("a late custom response cannot restore a signed-out session", async () => {
  const response = Promise.withResolvers<Response>();
  const api = createApi(
    "https://example.test",
    (async (url) =>
      String(url).endsWith("/logout")
        ? new Response(JSON.stringify({ signedOut: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        : response.promise) as typeof fetch,
    "platformkit_session=old",
  );
  const pending = api.request("GET", "/api/v1/note/me/notes", notes);
  await api.logout();
  response.resolve(
    new Response("[]", { headers: { "Set-Cookie": "platformkit_session=late; HttpOnly" } }),
  );
  assert.deepEqual(await pending, []);
  assert.equal(api.cookie(), undefined);
});

test("a response refused by its validator names the endpoint without exposing values", async () => {
  const path = "/api/v1/note/me/notes/8";
  let calls = 0;
  const api = createApi("https://example.test", (async () => {
    calls++;
    return new Response('{"private":"never show this"}', { status: 201 });
  }) as typeof fetch);
  await assert.rejects(
    api.request(
      "POST",
      path,
      () => {
        throw new Error("never show this");
      },
      {},
    ),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 201);
      assert.ok(error.detail.includes(path));
      assert.ok(!error.detail.includes("never show this"));
      assert.deepEqual(error.fields, {});
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("custom validators transform valid responses and refuse malformed JSON and empty bodies", async () => {
  const path = "/api/v1/note/count";
  const responses = ['{"count":9}', "{", ""];
  let validations = 0;
  const api = createApi(
    "https://example.test",
    (async () => new Response(responses.shift())) as typeof fetch,
  );
  const count = (value: unknown): number => {
    validations++;
    assert.ok(value && typeof value === "object" && "count" in value);
    assert.equal(typeof value.count, "number");
    return Number(value.count);
  };
  const result: number = await api.request("GET", path, count);
  assert.equal(result, 9);
  for (let i = 0; i < 2; i++) {
    await assert.rejects(api.request("GET", path, count), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 200);
      assert.ok(error.detail.includes(path));
      return true;
    });
  }
  assert.equal(validations, 2);
});

test("a missing validator is refused before a request leaves", async () => {
  let calls = 0;
  const api = createApi("https://example.test", (async () => {
    calls++;
    return new Response("{}");
  }) as typeof fetch);
  // @ts-expect-error the public contract requires a validator
  await assert.rejects(api.request("GET", "/api/v1/note/me/notes"), /validator is required/);
  assert.equal(calls, 0);
});
