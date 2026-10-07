// Regenerate only from the pinned public document. Check uses a disposable tree
// and compares both names and bytes; it never repairs the checked-in output.
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { format, resolveConfig } from "prettier";
import { apiConfig } from "./api-config";

export const FIXTURE = "testdata/openapi.json";
export const OUTPUT = "src/generated";

export async function verifySource(root: string): Promise<void> {
  const source = JSON.parse(await readFile(join(root, "testdata/openapi.source.json"), "utf8"));
  if (source.schema !== "platformkit.openapi-source.v1" || source.fixture !== FIXTURE)
    throw new Error("openapi.source.json: invalid schema or fixture");
  const upstream = source.upstream;
  if (
    upstream?.repository !== "https://github.com/septagon-oss/platformkit" ||
    !/^[a-f0-9]{40}$/.test(upstream?.commit ?? "") ||
    upstream?.path !== "apps/platformkit/testdata/openapi.json" ||
    typeof upstream?.command !== "string" ||
    !upstream.command.includes(upstream.commit) ||
    !upstream.command.includes(upstream.path)
  )
    throw new Error("openapi.source.json: invalid upstream provenance");
  const bytes = await readFile(join(root, FIXTURE));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (source.sha256 !== hash) throw new Error(`${FIXTURE}: provenance SHA-256 mismatch`);
}

export async function files(dir: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const child of await files(join(dir, entry.name))) result.push(`${entry.name}/${child}`);
    } else result.push(entry.name);
  }
  return result.sort();
}

export async function generate(root: string, output: string): Promise<void> {
  await verifySource(root);
  const { createClient } = await import("@hey-api/openapi-ts");
  await createClient(await apiConfig(join(root, FIXTURE), output));
  // Flat generated functions have no shared client. Remove the unused default
  // singleton emitted by the Fetch plugin; consumers must supply a connection.
  await rm(join(output, "client.gen.ts"));
  await routeCalls(root, output);
  const options = await resolveConfig(join(root, "package.json"));
  for (const name of await files(output)) {
    let text = await readFile(join(output, name), "utf8");
    // 0.99's bundled Fetch source passes explicit undefined to optional
    // parameters. Fix those constructions, keeping strict checking and the
    // wire types unchanged. serializedBody is its one deliberately assigned
    // undefined state; its declaration must describe that state.
    if (name === "client/types.gen.ts")
      text = text.replace("serializedBody?: string;", "serializedBody?: string | undefined;");
    if (name === "client/utils.gen.ts") {
      text = text
        .replaceAll(
          "allowReserved: options.allowReserved,",
          "allowReserved: options.allowReserved ?? false,",
        )
        .replace(
          "path: options.path,",
          "...(options.path === undefined ? {} : { path: options.path }),",
        )
        .replace(
          "query: options.query,",
          "...(options.query === undefined ? {} : { query: options.query }),",
        );
    }
    if (name === "core/pathSerializer.gen.ts")
      text = text.replaceAll(
        "        allowReserved,",
        "        allowReserved: allowReserved ?? false,",
      );
    if (name === "core/params.gen.ts")
      text = text.replace(
        "map: config.map,",
        "...(config.map === undefined ? {} : { map: config.map }),",
      );
    if (name === "client/client.gen.ts")
      text = text.replace(
        "body: opts.body as BodyInit | null | undefined,",
        "body: (opts.body as BodyInit | null | undefined) ?? null,",
      );
    if (name === "core/serverSentEvents.gen.ts") {
      text = text
        .replace("body: options.serializedBody,", "body: options.serializedBody ?? null,")
        .replace("event: eventName,", "...(eventName === undefined ? {} : { event: eventName }),")
        .replace("id: lastEventId,", "...(lastEventId === undefined ? {} : { id: lastEventId }),");
    }
    // 0.99 emits bigint defaults even with a number resolver. Preserve the
    // document's numeric default with the same representation as its validator.
    text = text.replace(/\.default\(BigInt\((-?\d+)\)\)/g, ".default($1)");
    await writeFile(
      join(output, name),
      await format(text, { ...options, parser: "typescript", filepath: name }),
    );
  }
}

/** The document is the only route inventory. This cannot add composition routes. */
async function routeCalls(root: string, output: string): Promise<void> {
  const document = JSON.parse(await readFile(join(root, FIXTURE), "utf8"));
  const entries: string[] = [];
  const bound: string[] = [];
  for (const [path, item] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(
      item as Record<
        string,
        {
          operationId: string;
          requestBody?: { content?: Record<string, unknown> };
          responses: Record<string, { content?: Record<string, unknown> }>;
        }
      >,
    )) {
      const name = operation.operationId.replace(/-([a-z])/g, (_, letter: string) =>
        letter.toUpperCase(),
      );
      const data = name[0]!.toUpperCase() + name.slice(1) + "Data";
      bound.push(
        `${name}: (options: Omit<types.${data}, "url"> & { signal?: AbortSignal }) => invoke(client => sdk.${name}({ ...options, client, throwOnError: true }))`,
      );
      const pattern =
        "^" +
        path
          .split(/(\{[^}]+\})/)
          .map((part) =>
            part.startsWith("{") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          )
          .join("") +
        "$";
      const jsonResponse = Object.entries(operation.responses).some(
        ([status, response]) => /^2\d\d$/.test(status) && response.content?.["application/json"],
      );
      const multipart = !!operation.requestBody?.content?.["multipart/form-data"];
      const statuses = Object.keys(operation.responses)
        .filter((status) => /^2\d\d$/.test(status))
        .map(Number);
      entries.push(
        `{ method: ${JSON.stringify(method.toUpperCase())}, pattern: new RegExp(${JSON.stringify(pattern)}), statuses: ${JSON.stringify(statuses)}, json: ${jsonResponse}, multipart: ${multipart}, run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => { const result = await sdk.${name}({ client, url, ...(body === undefined ? {} : {body}), throwOnError: true, ...(signal === undefined ? {} : {signal}) } as unknown as Parameters<typeof sdk.${name}<true>>[0]); return result; } }`,
      );
    }
  }
  await writeFile(
    join(output, "operations.gen.ts"),
    `// Generated from the pinned document by scripts/api.ts. Every method supplies its own connection.\nimport * as sdk from "./sdk.gen";\nimport type * as types from "./types.gen";\nimport type { Client } from "./client";\nexport function bindOperations(invoke: <T>(operation: (client: Client) => Promise<T>) => Promise<T>) { return {${bound.join(",\n")}}; }\nexport type Operations = ReturnType<typeof bindOperations>;\n`,
  );
  await writeFile(
    join(output, "routes.gen.ts"),
    `// Generated from the pinned document by scripts/api.ts. No route outside it is added.\nimport * as sdk from "./sdk.gen";\nimport type { Client } from "./client";\nconst routes = [${entries.join(",\n")}];\nexport function documentedRoute(method: string, path: string) { return routes.find(route => route.method === method && route.pattern.test(path.split("?")[0]!)); }\n`,
  );
}

export async function compare(expected: string, actual: string): Promise<void> {
  const names = await files(expected);
  let existing: string[] = [];
  try {
    existing = await files(actual);
  } catch {
    /* missing tree differs */
  }
  for (const name of new Set([...names, ...existing])) {
    if (!names.includes(name) || !existing.includes(name))
      throw new Error(`${OUTPUT}/${name}: missing or extra generated file`);
    if (!(await readFile(join(expected, name))).equals(await readFile(join(actual, name))))
      throw new Error(`${OUTPUT}/${name}: generated bytes differ; run npm run api`);
  }
}

export async function run(check: boolean, root = process.cwd()): Promise<void> {
  const temporary = await mkdtemp(join(tmpdir(), "platformkit-api-"));
  try {
    const generated = join(temporary, "generated");
    await generate(root, generated);
    const destination = join(root, OUTPUT);
    if (check) await compare(generated, destination);
    else {
      await rm(destination, { recursive: true, force: true });
      await mkdir(destination, { recursive: true });
      for (const name of await files(generated)) {
        await mkdir(resolve(destination, name, ".."), { recursive: true });
        await writeFile(join(destination, name), await readFile(join(generated, name)));
      }
    }
    console.log(`${OUTPUT}: ${check ? "current" : "regenerated"}`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  run(process.argv.includes("--check")).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
