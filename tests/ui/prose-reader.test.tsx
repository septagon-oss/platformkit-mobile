// A rich text body is read natively: every construct 0069 §1 allows comes back as text
// a person can read, in both modes, with the figure's box reserved by the frame the
// server measured so a paragraph below it never moves. The figure that never arrived
// says so with the kit's own words, and nothing else about the body is lost.
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import type { MediaItem } from "../../src/core/media";
import { deriveProse } from "../../src/core/prose";
import { MarkdownProse } from "../../src/screens/MarkdownProse";
import { Prose } from "../../src/ui/organisms/Prose";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const read = (source: string, figures: Record<string, MediaItem> = {}) => {
  const model = deriveProse({ source, figures }, presentation);
  if (!model.ok) throw new Error(model.issues.map((i) => `${i.path}:${i.code}`).join(", "));
  return model.value;
};

const inTheme = async (el: React.ReactElement, mode: "light" | "dark" = "light") =>
  await render(<ThemeProvider mode={mode}>{el}</ThemeProvider>);

const draw = (model: ReturnType<typeof read>, onOpen?: (id: string) => void) => (
  <Prose
    model={model}
    renderMarkdown={(source, id) => <MarkdownProse key={id} source={source} />}
    {...(onOpen === undefined ? {} : { onOpenFigure: onOpen })}
  />
);

const body = `## Temperament

A **quiet** dog that *loves* the sofa, ~~never~~ always awake by seven, and \`fast\`.

- Calm at home
  - Asleep by the radiator
    - Even under scaffolding

1. Wormed
2. Vaccinated

> Whippet, not greyhound.

\`\`\`text
feeding: 110 g twice
\`\`\`

| Coat | Length |
| --- | --- |

---

[Book a visit](https://vet.example.test/book)
`;

const frame: MediaItem = {
  id: "3f7b1c2e-8d5a-4e6f-9b1c-2a3d4e5f6a7b",
  width: 2400,
  height: 1600,
  description: "A greyhound asleep in the yard",
  decorative: false,
  state: "ready",
};

describe("the reader", () => {
  test.each(["light", "dark"] as const)(
    "every construct of §1 renders in %s mode",
    async (mode) => {
      await inTheme(draw(read(body)), mode);
      expect(screen.getByText("Temperament")).toBeTruthy();
      expect(screen.getByText(/quiet/)).toBeTruthy();
      expect(screen.getByText(/Asleep by the radiator/)).toBeTruthy();
      expect(screen.getByText(/Wormed/)).toBeTruthy();
      expect(screen.getByText(/Whippet, not greyhound/)).toBeTruthy();
      expect(screen.getByText(/feeding: 110 g twice/)).toBeTruthy();
      expect(screen.getByText("Coat")).toBeTruthy();
      expect(screen.getByText(/Book a visit/)).toBeTruthy();
    },
  );

  test("a figure reserves the box its stored frame gives it, and says its caption once", async () => {
    const model = read(
      '![A greyhound asleep in the yard](pk-file:3f7b1c2e-8d5a-4e6f-9b1c-2a3d4e5f6a7b "In the yard, after the race")',
      { "fig-0": frame },
    );
    await inTheme(draw(model));
    expect(screen.getByTestId("prose-figure-fig-0")).toBeTruthy();
    expect(screen.getByText("In the yard, after the race")).toBeTruthy();
    expect(screen.getByTestId("prose-figure-open-fig-0").props.accessibilityLabel).toBe(
      "Open, A greyhound asleep in the yard",
    );
  });

  test("a figure whose frame is not known yet is loading, and reserves nothing", async () => {
    await inTheme(draw(read("![One](pk-file:3f7b1c2e-8d5a-4e6f-9b1c-2a3d4e5f6a7b)")));
    expect(screen.getByTestId("prose-figure-loading-fig-0")).toBeTruthy();
  });

  test("a missing image says so and loses none of the text around it", async () => {
    const model = read(
      "Before.\n\n![One](pk-file:3f7b1c2e-8d5a-4e6f-9b1c-2a3d4e5f6a7b)\n\nAfter.",
      {
        "fig-0": { ...frame, state: "error" },
      },
    );
    const onOpen = jest.fn();
    await inTheme(draw(model, onOpen));
    expect(screen.getByText("Image unavailable")).toBeTruthy();
    expect(screen.getByText(/Before/)).toBeTruthy();
    expect(screen.getByText(/After/)).toBeTruthy();
    expect(screen.queryByTestId("prose-figure-retry-fig-0")).toBeNull();
    fireEvent.press(screen.getByTestId("prose-figure-open-fig-0"));
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("a ready figure opens, and a decorative one is not a thing to open", async () => {
    const onOpen = jest.fn();
    const openable = read("![One](pk-file:3f7b1c2e-8d5a-4e6f-9b1c-2a3d4e5f6a7b)", {
      "fig-0": frame,
    });
    await inTheme(draw(openable, onOpen));
    fireEvent.press(screen.getByTestId("prose-figure-open-fig-0"));
    expect(onOpen).toHaveBeenCalledWith("fig-0");

    const decorative = read("![](pk-file:3f7b1c2e-8d5a-4e6f-9b1c-2a3d4e5f6a7b)", {
      "fig-0": { ...frame, description: "", decorative: true },
    });
    await inTheme(draw(decorative, onOpen));
    expect(screen.getByTestId("prose-figure-open-fig-0").props.accessibilityRole).toBe("image");
  });

  test("a body the phone cannot draw is refused by the reader, not drawn as less", () => {
    const split = deriveProse(
      {
        source: "Look at ![this](pk-file:11111111-1111-4111-8111-111111111111) here.",
        figures: {},
      },
      presentation,
    );
    expect(split.ok).toBe(false);
    if (split.ok) return;
    expect(split.issues[0]!.code).toBe("unsupported-format");
  });
});
