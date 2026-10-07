// One offline generator configuration for both writing and checking the client.
import type { UserConfig } from "@hey-api/openapi-ts";

export async function apiConfig(input: string, output: string): Promise<UserConfig> {
  const { $ } = await import("@hey-api/openapi-ts");
  return {
    input,
    logs: { file: false },
    output: { path: output },
    plugins: [
      "@hey-api/typescript",
      {
        name: "zod",
        dates: { offset: true },
        "~resolvers": {
          number(ctx) {
            // JSON numbers remain numbers. The default int64 resolver coerces
            // strings to bigint, which is neither this wire nor the native UI.
            if (ctx.schema.format !== "int64" && ctx.schema.format !== "uint64") return;
            let value = $(ctx.plugin.imports.z).attr("number").call().attr("int").call();
            if (ctx.schema.minimum !== undefined)
              value = value.attr("min").call($.literal(ctx.schema.minimum));
            if (ctx.schema.maximum !== undefined)
              value = value.attr("max").call($.literal(ctx.schema.maximum));
            return value;
          },
        },
      },
      { name: "@hey-api/client-fetch", baseUrl: false },
      {
        name: "@hey-api/sdk",
        client: false,
        auth: false,
        validator: { request: false, response: true },
      },
    ],
  };
}
