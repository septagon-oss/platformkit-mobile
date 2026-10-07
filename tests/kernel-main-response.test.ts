// A response header is not a completed read. The shipped command must refuse a
// stalled catalogue body and a missing catalogue, retaining the commit it learned. The
// two answers come from different places — the 404 is the forge's and the bound is the
// job's own — so each mode asserts which one spoke: a read that ran out of budget is
// never accepted for a status, and a status is never accepted for a budget that had
// still to run. BOUND_MS sizes that budget to the runner rather than the desk; the
// reason, and the measurements behind it, are on the constant.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import test from "node:test";
import { CATALOG_FILE } from "../scripts/kernel_main";

const run = promisify(execFile);
const commit = "a1".repeat(20);
const token = "response-test-token";

/**
 * BOUND_MS is the one budget both modes are run with, and BACKSTOP_MS the harness's own
 * end of the child. One number serves both because the modes are told apart by which
 * sentence the run prints, not by how long it was given.
 *
 * The first version gave the child 1000 ms, and the ci runner — where the same spawn
 * takes 2.6 s to reach the read where it costs 0.12 s here, and a loopback exchange
 * measured 212 ms against 12 ms here under the load that reproduces the failure — spent
 * that before the second of its two GETs was answered. The 404 was then refused as a
 * bound, which is the false sentence this file exists to keep the script from printing,
 * arriving as a red job for a reason that was not the change. 10 s leaves the read ten
 * times what the slowest runner took to fail to finish it, and the harness waits four
 * bounds, so a lost bound ends in a killed child and `result.code === 1` refuses that;
 * the budget the run actually enforced is the number its own stderr has to print.
 */
const BOUND_MS = 10_000;
const BACKSTOP_MS = 4 * BOUND_MS;

for (const mode of ["stalled body", "missing file"] as const) {
  test(`the shipped command refuses a catalogue ${mode} with its commit`, async (t) => {
    const asked: string[] = [];
    const server = http.createServer((req, res) => {
      const url = req.url ?? "";
      asked.push(url);
      if (req.headers.authorization !== `token ${token}`) {
        res.writeHead(401).end();
      } else if (url.includes("/commits?")) {
        res.end(JSON.stringify([{ sha: commit }]));
      } else if (url.includes(CATALOG_FILE)) {
        if (mode === "missing file") res.writeHead(404).end();
        else {
          res.writeHead(200, { "content-type": "text/plain" });
          res.flushHeaders();
          res.write('{"catalogVersion":');
        }
      } else res.writeHead(500).end();
    });
    t.after(async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
    const result = await run(process.execPath, ["--import", "tsx", "scripts/kernel_main.ts"], {
      env: {
        ...process.env,
        PK_KERNEL_SERVER: origin,
        PK_KERNEL_REPOSITORY: "septagon-oss/platformkit",
        GITHUB_TOKEN: token,
        PK_KERNEL_TIMEOUT_MS: String(BOUND_MS),
      },
      timeout: BACKSTOP_MS,
    }).then(
      (output) => ({ ...output, code: 0 }),
      (error: unknown) => {
        const failure = error as { code: unknown; stdout: string; stderr: string };
        return failure;
      },
    );
    assert.equal(result.code, 1, result.stdout + result.stderr);
    assert.match(result.stdout, new RegExp(`kernel ${commit} read at `));
    assert.match(result.stderr, /refused fetch: GET .*raw\/ui\/screens\/testdata\/catalog.json/);
    assert.match(
      result.stderr,
      mode === "stalled body" ? new RegExp(`${String(BOUND_MS)}ms bound`) : /answered 404/,
    );
    // Which sentence spoke is the whole case: a body that never arrives is the job's
    // budget talking, and a 404 is the forge answering while that budget still has to
    // run. A bound that expired on the way to a 404 says so in the same stderr, and the
    // line above refuses it no way round.
    if (mode === "missing file")
      assert.doesNotMatch(result.stderr, /bound/, "a 404 is not the job's budget answering");
    assert.equal(asked.length, 2, "a refused catalogue stops before the OpenAPI read");
    assert.ok(asked[1]);
    assert.equal(new URL(asked[1], origin).searchParams.get("ref"), commit);
    assert.doesNotMatch(result.stdout + result.stderr, /this build reads kernel main/);
    assert.ok(!(result.stdout + result.stderr).includes(token));
  });
}
