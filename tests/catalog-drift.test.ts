// These cases hold one rule about the public module proxy: an attempt that answered
// nothing is not an answer, and `unreachable` is only told from `latest` if the
// lookup asked until it got something or ran out of attempts. Which half failed
// decides what the report may say — `note  cannot tell whether a newer version is
// published`, never a second `ok` — so every case asserts both the count of
// questions put to the proxy and the line `report` draws from the answer. A status
// that answers about the module path (a 404, which is what a path spelled without
// its host looks like) is asked once, so a retry cannot spend three attempts
// turning the one failure this lookup exists to report into a note. Silence has two
// shapes and both are asked again: a request that never completes, and a 200 whose
// body stops arriving — headers are the start of an answer, not the whole of one.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lookupLatest, provenance, report, type Deps, type LatestLookup } from "../scripts/catalog";

// The failure this file was written for, measured on this host rather than invented:
// undici gives up on a connect after ten seconds and throws a TypeError whose cause
// names the address and the timeout. On a machine running many suites at once that
// is an ordinary moment, and one attempt at it is the difference between "nothing
// newer was published" and "I could not ask".
const timeout = (): Error =>
  new TypeError("fetch failed", {
    cause: new Error(
      "Connect Timeout Error (attempted address: proxy.golang.org:443, timeout: 10000ms)",
    ),
  });

const answered = (status: number, body: string): Response =>
  new Response(body, { status, headers: { "content-type": "application/json" } });

/**
 * proxy is the double for `@latest`: it answers in order, records every URL, and
 * refuses a further question the way the doubles in tests/catalog.test.ts refuse an
 * unexpected one, so "asked again" is an assertion about a count rather than about a
 * log line. `waited` records the pauses, which is how the retry is proven to wait
 * instead of hammering the cache.
 */
function proxy(answers: (Response | Error)[]): {
  readonly deps: Deps;
  readonly asked: string[];
  readonly waited: number[];
} {
  const asked: string[] = [];
  const waited: number[] = [];
  const deps: Deps = {
    fetch: (async (input: string | URL | Request) => {
      asked.push(String(input));
      const answer = answers.shift();
      if (answer === undefined)
        throw new Error(`the lookup asked a further question: ${String(input)}`);
      if (answer instanceof Error) throw answer;
      return answer;
    }) as unknown as typeof fetch,
    wait: async (ms: number) => {
      waited.push(ms);
    },
  };
  return { deps, asked, waited };
}

// The recorded module, read through the validator `readSource` reads it with, so the
// path the proxy is asked about in these cases is the one this repository carries.
const source = provenance(
  JSON.parse(
    readFileSync(new URL("../testdata/catalog.source.json", import.meta.url).pathname, "utf8"),
  ) as unknown,
);
const pinned = Buffer.from('{"catalogVersion":1}');

/** ask runs the shipped lookup over the double and hands back both answers. */
async function ask(
  answers: (Response | Error)[],
): Promise<[LatestLookup, ReturnType<typeof proxy>]> {
  const p = proxy(answers);
  return [await lookupLatest(source, p.deps), p];
}

/** silence is the refusal's sentence, and refuses a run that answered instead. */
function silence(got: LatestLookup): string {
  assert.equal(got.state, "unreachable", `expected a lookup that could not tell, got ${got.state}`);
  return got.state === "unreachable" ? got.detail : "";
}

test("the proxy is asked the recorded module path, once, when it answers", async () => {
  const [got, p] = await ask([answered(200, '{"Version":"v1.2.0"}')]);
  assert.deepEqual(got, { state: "latest", version: "v1.2.0" });
  assert.deepEqual(p.asked, [
    `https://proxy.golang.org/github.com/septagon-oss/platformkit/@latest`,
  ]);
  assert.deepEqual(p.waited, []);
});

test("a proxy that answers nothing is asked again, and still cannot say ok", async () => {
  const [got, p] = await ask([timeout(), timeout(), timeout()]);
  assert.equal(got.state, "unreachable");
  assert.equal(p.asked.length, 3, "three attempts, because silence is not an answer");
  assert.deepEqual(
    p.waited,
    [500, 500],
    "it waits between attempts rather than hammering the cache",
  );
  const detail = silence(got);
  assert.match(detail, /attempt 1: https:\/\/proxy\.golang\.org\/.*fetch failed/);
  assert.match(detail, /Connect Timeout Error/);
  assert.match(detail, /attempt 3: /);
  const lines = report(source, pinned, pinned, got).join("\n");
  assert.match(lines, /^note  cannot tell whether a newer version is published: /m);
  assert.equal(/^ok .*\nok /m.test(lines), false, "three silences cannot report two oks");
});

test("a status that answers about the path is asked once", async () => {
  // The case that keeps the retry honest: a module path spelled without its host
  // answers 404, and an answer about the path is the failure this lookup exists to
  // surface. Asking again may not turn it into a note three attempts late.
  const [got, p] = await ask([answered(404, '{"message":"not found"}')]);
  assert.equal(got.state, "unreachable");
  assert.equal(p.asked.length, 1, "the attempt that showed the wrong path is the last one");
  assert.deepEqual(p.waited, []);
  assert.match(silence(got), /@latest answered 404$/);
});

test("a proxy that comes back answers for the version it names", async () => {
  for (const status of [408, 429, 500, 503]) {
    const [got, p] = await ask([
      answered(status, "gateway"),
      answered(200, '{"Version":"v9.9.9"}'),
    ]);
    assert.deepEqual(got, { state: "latest", version: "v9.9.9" }, `${status} says try again`);
    assert.equal(p.asked.length, 2);
    assert.deepEqual(p.waited, [500]);
  }
});

test("a 200 that names no version is an answer, and a 200 that is not JSON is not", async () => {
  const [empty, pe] = await ask([answered(200, "{}")]);
  assert.match(silence(empty), /returned no version$/);
  assert.equal(pe.asked.length, 1, "the proxy answered; there was nothing to ask again about");

  // A Response carries a body that can be read once, so each attempt gets its own.
  const page = (): Response => answered(200, "<html><body>Sign in</body></html>");
  const [html, ph] = await ask([page(), page(), page()]);
  assert.match(silence(html), /a body that is not JSON/);
  assert.equal(ph.asked.length, 3, "a green status wearing a page answered nothing");
});

test("a 200 whose body stops arriving is silence, asked again, and never thrown", async () => {
  // The second half of a response is a read that can fail. Measured before this
  // case existed, a socket closed mid-body threw out of `lookupLatest` — headers
  // arrive, `response.text()` rejects, and the throw sat outside the transport's
  // catch — so `drift` printed a bare exception with no host, no path and no
  // attempt count, and the workflow that runs it had no line to read. A body that
  // dies says nothing about whether a newer version is published, which is what
  // `silence` means: ask again, and be `unreachable` when asking runs out.
  const cutMidBody = (): Response =>
    new Response(
      new ReadableStream<Uint8Array>({
        start: (controller) => controller.error(new Error("socket closed during body")),
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const [gone, pg] = await ask([cutMidBody(), cutMidBody(), cutMidBody()]);
  assert.equal(gone.state, "unreachable");
  assert.equal(pg.asked.length, 3, "a body that died is an attempt, not a verdict");
  assert.deepEqual(pg.waited, [500, 500]);
  const detail = silence(gone);
  assert.match(
    detail,
    /attempt 1: https:\/\/proxy\.golang\.org\/.*@latest answered 200 and then stopped sending: socket closed during body/,
    "the sentence names the host, the path, the status it stopped at and why",
  );
  assert.match(detail, /attempt 3: /);
  const lines = report(source, pinned, pinned, gone).join("\n");
  assert.match(lines, /^note  cannot tell whether a newer version is published: /m);
  assert.equal(/^ok .*\nok /m.test(lines), false, "three cut bodies cannot report two oks");

  // The half only a retry can show: the next attempt's body does arrive.
  const [back, pb] = await ask([cutMidBody(), answered(200, '{"Version":"v9.9.9"}')]);
  assert.deepEqual(back, { state: "latest", version: "v9.9.9" });
  assert.equal(pb.asked.length, 2);
  assert.deepEqual(pb.waited, [500]);
});
