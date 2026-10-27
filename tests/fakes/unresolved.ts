// The served golden as it was before the server resolved a policy: the cases that
// derive from the phone's own rules mutate this document, and a policy block that
// still described the unmutated schema would no longer describe the entry.
export function unresolved<T>(doc: T): T {
  const resources = (doc as { resources?: Record<string, unknown>[] }).resources ?? [];
  for (const entry of resources) delete entry.resolved;
  return doc;
}
