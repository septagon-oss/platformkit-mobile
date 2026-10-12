// The reader is styled only by the kit's tokens, in both modes (0069 §8: prose,
// figures, tables and code are styled only by tokens; dark mode is checked). A code
// block sits on the palette's muted surface and a heading takes the type scale's size,
// so in dark mode the code is readable on its own surface and no default of the
// Markdown face shows through.
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { deriveProse } from "../../src/core/prose";
import { MarkdownProse } from "../../src/screens/MarkdownProse";
import { Prose } from "../../src/ui/organisms/Prose";
import { ThemeProvider, themeFor } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const body = "## Temperament\n\n```text\nfeeding: 110 g twice\n```\n\nSee `the chart` too.";

const draw = (mode: "light" | "dark") => {
  const model = deriveProse({ source: body, figures: {} }, presentation);
  if (!model.ok) throw new Error(model.issues.map((i) => `${i.path}:${i.code}`).join(", "));
  return (
    <ThemeProvider mode={mode}>
      <Prose
        model={model.value}
        renderMarkdown={(run, id) => <MarkdownProse key={id} source={run} />}
      />
    </ThemeProvider>
  );
};

/** flat merges a style prop the way React Native does, nearest-last wins. */
const flat = (style: unknown): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const walk = (s: unknown) => {
    if (Array.isArray(s)) s.forEach(walk);
    else if (s && typeof s === "object") Object.assign(out, s);
  };
  walk(style);
  return out;
};

/** Drawn is what this case reads of a rendered element: its style and its parent. */
interface Drawn {
  readonly props: { readonly style?: unknown };
  readonly parent: Drawn | null;
}

/** own is the style of the element and its parents up to the first that sets the key. */
const own = (el: Drawn, key: string): unknown => {
  let node: Drawn | null = el;
  while (node) {
    const style = flat(node.props.style);
    if (key in style) return style[key];
    node = node.parent;
  }
  return undefined;
};

test.each(["light", "dark"] as const)(
  "a code block sits on the palette's muted surface in %s mode",
  async (mode) => {
    const t = themeFor(mode);
    await render(draw(mode));
    expect(own(screen.getByText(/feeding/), "backgroundColor")).toBe(t.color.surfaceMuted);
    expect(own(screen.getByText("the chart"), "backgroundColor")).toBe(t.color.surfaceMuted);
    expect(own(screen.getByText(/feeding/), "fontFamily")).toBe(t.font.mono);
  },
);

test("a heading and a paragraph take the type scale's size, not the face's default", async () => {
  const t = themeFor("light");
  await render(draw("light"));
  expect(own(screen.getByText("Temperament"), "fontSize")).toBe(t.type.title.size);
  expect(own(screen.getByText(/See/), "fontSize")).toBe(t.type.body.size);
});
