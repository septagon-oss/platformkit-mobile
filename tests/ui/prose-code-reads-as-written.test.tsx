// Code is drawn as the author wrote it: a fenced block and an inline code span are
// literal in 0069 §1 and in CommonMark, so no character inside them is escaped on the
// way to the face. A shell line such as `make || echo failed` reads the same on the
// phone as on the web, and a person who copies it from the screen copies a command
// that runs.
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { deriveProse } from "../../src/core/prose";
import { MarkdownProse } from "../../src/screens/MarkdownProse";
import { Prose } from "../../src/ui/organisms/Prose";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const draw = (source: string) => {
  const model = deriveProse({ source, figures: {} }, presentation);
  if (!model.ok) throw new Error(model.issues.map((i) => `${i.path}:${i.code}`).join(", "));
  return (
    <ThemeProvider mode="light">
      <Prose
        model={model.value}
        renderMarkdown={(run, id) => <MarkdownProse key={id} source={run} />}
      />
    </ThemeProvider>
  );
};

test("a fenced block shows the bars it holds, with no escape added", async () => {
  await render(draw("```sh\nmake || echo failed\n```"));
  expect(screen.getByText("make || echo failed")).toBeTruthy();
});

test("an inline code span shows the bars it holds, with no escape added", async () => {
  await render(draw("Run `a || b` first, then c || d."));
  expect(screen.getByText("a || b")).toBeTruthy();
  expect(screen.getByText(/then c \|\| d\./)).toBeTruthy();
});
