// The publish step's credential, as the real npm reads it. The workflow writes
// the token into a userconfig keyed by the registry's address, and npm sends it
// only if that key matches the URL it publishes to — a stub cannot tell. So the
// step's own `run:` body runs here with the installed npm against a registry
// served in-process that, like the forge, refuses an anonymous read: the write
// has to carry the token, and a version the registry already holds is never
// written again, whatever the anonymous read answered.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { promisify } from "node:util";
import { parse } from "yaml";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  name: string;
  version: string;
};
const TOKEN = "npm_publish_secret_7c41e0";

function publishStep(): string {
  const workflow = parse(readFileSync(path.join(root, ".gitea/workflows/publish.yml"), "utf8")) as {
    jobs: { publish: { steps: { name?: string; run?: string }[] } };
  };
  const found = workflow.jobs.publish.steps.find(
    (entry) => entry.name === "Publish the kit to the forge registry",
  );
  assert.ok(found?.run, "publish.yml has a publish step with a shell body");
  return found.run;
}

interface Request {
  method: string;
  authorized: boolean;
}

/**
 * registry answers like the forge's npm route: an anonymous read is 401, an
 * authorized read answers the versions it holds, and a write is accepted only
 * for a version it does not hold yet.
 */
async function registry(
  t: TestContext,
  holds: string[],
): Promise<{ url: string; requests: Request[] }> {
  const requests: Request[] = [];
  const server = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      const authorized = req.headers.authorization === `Bearer ${TOKEN}`;
      requests.push({ method: req.method ?? "", authorized });
      if (!authorized) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end('{"error":"unauthorized"}');
      } else if (req.method === "GET" && holds.length > 0) {
        const versions = Object.fromEntries(
          holds.map((version) => [
            version,
            { name: manifest.name, version, dist: { tarball: "x", shasum: "x" } },
          ]),
        );
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({ name: manifest.name, "dist-tags": { latest: holds[0] }, versions }),
        );
      } else if (req.method === "GET") {
        res.writeHead(404, { "content-type": "application/json" });
        res.end("{}");
      } else if (req.method === "PUT" && !holds.includes(manifest.version)) {
        res.writeHead(201, { "content-type": "application/json" });
        res.end('{"ok":true}');
      } else {
        res.writeHead(400, { "content-type": "application/json" });
        res.end('{"error":"package version already exists"}');
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/api/packages/septagon-oss/npm/`, requests };
}

async function runStep(
  t: TestContext,
  url: string,
): Promise<{ status: number; log: string; left: string[] }> {
  const temp = mkdtempSync(path.join(os.tmpdir(), "pk-publish-credential-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, "tmp");
  const cache = path.join(temp, "cache");
  mkdirSync(home);
  mkdirSync(cache);
  // A runner's step starts with no npm configuration in its environment; `npm
  // run test` exports its own npm_config_* to this process, and those would
  // outrank the userconfig the step names.
  const runner = { ...process.env };
  for (const key of Object.keys(runner)) if (/^npm_/i.test(key)) delete runner[key];
  try {
    const { stdout, stderr } = await promisify(execFile)("bash", ["-c", publishStep()], {
      cwd: root,
      timeout: 120_000,
      env: {
        ...runner,
        TMPDIR: home,
        npm_config_cache: cache,
        NODE_COMPILE_CACHE: cache,
        NPM_PUBLISH_TOKEN: TOKEN,
        NPM_REGISTRY: url,
      },
    });
    return { status: 0, log: `${stdout}${stderr}`, left: readdirSync(home) };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return {
      status: typeof failed.code === "number" ? failed.code : 1,
      log: `${failed.stdout ?? ""}${failed.stderr ?? ""}`,
      left: readdirSync(home),
    };
  }
}

test("the publish step's write reaches the registry with the repository's token", async (t) => {
  const forge = await registry(t, []);
  const run = await runStep(t, forge.url);
  assert.equal(run.status, 0, run.log);
  const writes = forge.requests.filter((request) => request.method === "PUT");
  assert.equal(writes.length, 1, `one write: ${JSON.stringify(forge.requests)}`);
  assert.ok(writes[0]!.authorized, "the write carries the token the step wrote for npm");
  assert.doesNotMatch(run.log, new RegExp(TOKEN), "the credential is never printed");
  assert.deepEqual(run.left, [], "the file holding the credential leaves with the step");
});

test("a version the registry holds is never written again, though an anonymous read is refused", async (t) => {
  const forge = await registry(t, [manifest.version]);
  const run = await runStep(t, forge.url);
  assert.notEqual(run.status, 0, "an existing version refuses the publish");
  assert.equal(
    forge.requests.filter((request) => request.method === "PUT").length,
    0,
    `the refusal writes nothing: ${JSON.stringify(forge.requests)}`,
  );
  assert.deepEqual(run.left, [], "the private directory the step made is gone with it");
});
