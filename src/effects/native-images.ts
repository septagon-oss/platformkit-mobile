/** clearImageMemory is best effort; namespace withdrawal never depends on a native cache purge. */
export async function clearImageMemory(clear: () => Promise<boolean>): Promise<void> {
  try {
    await clear();
  } catch {
    // A failed purge cannot keep a session alive or restore its image resources.
  }
}
