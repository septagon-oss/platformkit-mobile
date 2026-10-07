// A response header is not a completed read. The shipped command must refuse a
// stalled catalogue body and a missing catalogue, retaining the commit it learned.
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
        PK_KERNEL_TIMEOUT_MS: "1000",
      },
      timeout: 10_000,
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
    assert.match(result.stderr, mode === "stalled body" ? /1000ms bound/ : /answered 404/);
    assert.equal(asked.length, 2, "a refused catalogue stops before the OpenAPI read");
    assert.ok(asked[1]);
    assert.equal(new URL(asked[1], origin).searchParams.get("ref"), commit);
    assert.doesNotMatch(result.stdout + result.stderr, /this build reads kernel main/);
    assert.ok(!(result.stdout + result.stderr).includes(token));
  });
}
