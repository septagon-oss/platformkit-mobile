// Success bodies are unknown until the contract accepts them. Dynamic catalog
// rows keep only the generic record/envelope contract; they do not become
// operations in the reference document by sharing that shape.
import { z } from "zod";
import { zIdentity, zPageEventBody, zPageTaskBody } from "../generated/zod.gen";

export const row = z.record(z.string(), z.unknown());
export const page = zPageTaskBody
  .pick({ items: true, total: true })
  .extend({
    items: z.array(row).nullable(),
  })
  .transform((value) => ({ items: value.items ?? [], total: value.total }));
export const identity = zIdentity.transform(({ userId, email }) => ({ userId, email }));
export const trail = zPageEventBody.transform(({ items, total }) => ({
  items: (items ?? []).map(({ id, name, occurredAt, payload, actor }) => ({
    id,
    name,
    occurredAt,
    payload,
    ...(actor === undefined ? {} : { actor }),
  })),
  total,
}));

/** Only contract field names and array indexes belong in a response refusal. */
export function issuePath(error: unknown): string {
  if (!(error instanceof z.ZodError)) return "$";
  return (
    error.issues[0]?.path.reduce<string>(
      (path, part) =>
        typeof part === "number" ? `${path}[${part}]` : `${path ? `${path}.` : ""}${String(part)}`,
      "",
    ) || "$"
  );
}
