/** svgNodes reads terminal native SVG props after the real parser and component tree have rendered. */
export function svgNodes(tree: unknown): { type: string; props: Record<string, unknown> }[] {
  if (!tree || typeof tree !== "object") return [];
  const node = tree as { type?: string; props?: Record<string, unknown>; children?: unknown[] };
  return [
    ...(node.type?.startsWith("RNSVG") ? [{ type: node.type, props: node.props ?? {} }] : []),
    ...(node.children ?? []).flatMap(svgNodes),
  ];
}
