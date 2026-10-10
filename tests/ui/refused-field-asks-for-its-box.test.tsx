// The sheet does not merely say which field is wrong, it asks for that field: the
// organism keeps the ref of every box it drew and, when the hook names the field it is
// waiting on, focuses that one box. These cases prove the wiring picks the field the
// person meets first and never another — and that a refusal about a control with no
// box to focus (a choice, a date, a switch, a tag box) leaves the notice above the
// fields to say it, rather than focusing something that cannot be typed into.
//
// What Jest cannot decide is the visible half: the keyboard, the scroll position a
// person sees, and a screen reader speaking. Those are named in the commit's
// `Not verified:` and belong on a device.
import React from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import { formSections } from "../../src/core/derive";
import { ResourceForm } from "../../src/ui/organisms/ResourceForm";
import { ThemeProvider } from "../../src/ui/theme";
import { feedback } from "../fakes/presentation";

/** Every box the stub was asked to focus, in the order it was asked. */
const focused: string[] = [];

// The sheet hands a ref to every text box it draws (that is how it focuses one), so a
// case that asks which box it focused has to see the call. The box is drawn for real
// and only its own `focus` is wrapped — the ref the sheet keeps is the same mounted
// TextInput instance a phone would hand it, and the rest of the tree (the fields, the
// sections, the notice above them) is untouched.
jest.mock("../../src/ui/atoms/TextField", () => {
  const ReactModule = jest.requireActual("react") as typeof React;
  const Real = (jest.requireActual("../../src/ui/atoms/TextField") as { TextField: unknown })
    .TextField;
  return {
    TextField: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<{ focus?: () => void } | null>) => {
        const inner = ReactModule.useRef<{ focus?: () => void } | null>(null);
        // The sheet's own effect is a passive one, which runs after every layout
        // effect below it: this is where the box's `focus` is wrapped so a case can
        // see the call the sheet made, and the box still does what a box does.
        ReactModule.useLayoutEffect(() => {
          const node = inner.current;
          if (!node) return;
          const named = String(props.testID ?? "?");
          const was = node.focus?.bind(node);
          node.focus = () => {
            focused.push(named);
            if (was) was();
          };
        }, []);
        // The box is mounted before this runs (a child's ref is attached before its
        // parent's handle is built), so what the sheet is handed is a live box.
        ReactModule.useImperativeHandle(ref, () => inner.current as { focus?: () => void }, []);
        return ReactModule.createElement(Real as React.ComponentType<Record<string, unknown>>, {
          ...props,
          ref: inner,
        });
      },
    ),
  };
});

const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
const note = catalog.resources.find((r) => r.entity === "note")!;
const blocks = formSections(note, undefined, true, feedback.copy.kit.overview);
const none = () => undefined;

beforeEach(() => {
  focused.length = 0;
});

describe("the sheet's refusal asks for its box", () => {
  const drawn = (awaiting: string, errors: Readonly<Record<string, string>>) =>
    render(
      <ThemeProvider mode="light">
        <ResourceForm
          feedback={feedback}
          initialDate={new Date("2026-08-11T08:20:00Z")}
          blocks={blocks}
          held={{}}
          errors={errors}
          detail="Review the highlighted fields."
          awaiting={awaiting}
          phase="editing"
          onChange={none}
          onRetry={none}
        />
      </ThemeProvider>,
    );

  test("the box the sheet is waiting on is the one it brings forward", async () => {
    await drawn("title", { title: "Enter a title.", rank: "Enter a valid number." });
    expect(focused).toEqual(["input-title"]);
  });

  test("a refusal about a control with no box to focus focuses nothing", async () => {
    // A date row, a choice and a switch are pressed, not focused. The sentence under
    // the field and the urgent notice above them are what say it; nothing here steals
    // the keyboard from the box a person could actually type into.
    await drawn("tags", { tags: "Remove the comma from this value." });
    expect(focused).toEqual([]);
    // Said where it stands: the sentence under the box, and the notice above them all.
    expect(screen.getByText("Remove the comma from this value.")).toBeOnTheScreen();
  });

  test("with nothing to mend the sheet takes the keyboard from nobody", async () => {
    await drawn("", {});
    expect(focused).toEqual([]);
    expect(screen.getByTestId("input-title")).toBeOnTheScreen();
  });
});
