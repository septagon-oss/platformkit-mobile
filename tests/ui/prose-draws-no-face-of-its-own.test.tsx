// The reader is drawn only from the kit's tokens, in both modes — no colour, face or
// size of the Markdown library ever reaches a screen. One element cannot answer that: a
// style written under a key the library never reads is invisible to a case that looks at
// one block, and the library's own default lands on the screen beside it. So this asks
// the question of every element of a whole body: each colour must be a role of the
// palette, each face one of the three the theme names, each size one of the scale's.
import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { deriveProse } from "../../src/core/prose";
import { MarkdownProse } from "../../src/screens/MarkdownProse";
import { Prose } from "../../src/ui/organisms/Prose";
import { ThemeProvider, themeFor, type Theme } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const body = `## Temperament

A **quiet** dog that *loves* the sofa, ~~never~~ awake by seven, and \`fast\`.

- Calm at home
  - Asleep by the radiator

1. Wormed
2. Vaccinated

> Whippet, not greyhound.

\`\`\`sh
make || echo failed
\`\`\`

| Coat | Length |
| --- | --- |
| Short | 2 mm |

---

[Book a visit](https://vet.example.test/book)
`;

const INK = ["color", "backgroundColor", "borderColor", "borderLeftColor", "shadowColor"];

/** Node is one element of a rendered tree: what it was styled with, and what hangs off it. */
interface Node {
  readonly type?: unknown;
  readonly props?: { readonly style?: unknown };
  readonly children?: readonly (Node | string | null)[] | null;
}

/** drawn is every element's merged style, in the order the tree meets them. */
function drawn(node: Node | null, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!node || typeof node.type !== "string") return out;
  const flat = StyleSheet.flatten(node.props?.style as never);
  if (flat && typeof flat === "object") out.push(flat as Record<string, unknown>);
  for (const child of node.children ?? []) if (typeof child === "object") drawn(child, out);
  return out;
}

describe("the reader's own tokens", () => {
  test.each(["light", "dark"] as const)(
    "every colour, face and size of a whole body is the kit's in %s mode",
    async (mode) => {
      const t: Theme = themeFor(mode);
      const model = deriveProse({ source: body, figures: {} }, presentation);
      if (!model.ok) throw new Error(model.issues.map((i) => `${i.path}:${i.code}`).join(", "));
      const tree = (
        await render(
          <ThemeProvider mode={mode}>
            <Prose
              model={model.value}
              renderMarkdown={(source, id) => <MarkdownProse key={id} source={source} />}
            />
          </ThemeProvider>,
        )
      ).toJSON() as Node;

      const ink = new Set<string>(Object.values(t.color));
      const faces = new Set<unknown>([t.font.body, t.font.display, t.font.mono]);
      const scale = new Set<unknown>(
        Object.values(t.type).flatMap((role) => [role.size, role.line]),
      );
      const stray: string[] = [];
      for (const style of drawn(tree)) {
        for (const key of INK)
          if (typeof style[key] === "string" && !ink.has(style[key] as string))
            stray.push(`${key} ${String(style[key])}`);
        if (style.fontFamily !== undefined && !faces.has(style.fontFamily))
          stray.push(`fontFamily ${String(style.fontFamily)}`);
        for (const key of ["fontSize", "lineHeight"])
          if (style[key] !== undefined && !scale.has(style[key]))
            stray.push(`${key} ${String(style[key])}`);
      }
      expect(stray).toEqual([]);
      expect(drawn(tree).length).toBeGreaterThan(10);
    },
  );
});
