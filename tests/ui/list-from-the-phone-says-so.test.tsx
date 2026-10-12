// An empty page this phone answered is not "nothing exists": it is "nothing was
// there the last time this device heard". The list says which of the two it is,
// and does not write "none yet" over an answer it cannot vouch for.
import React from "react";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { deriveCopy, noOrder } from "../../src/core/derive";
import { ResourceList } from "../../src/ui/organisms/ResourceList";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";
import { catalog } from "../fakes/shell";

const none = () => undefined;
const note = catalog.resources.find((r) => r.entity === "note")!;
const words = deriveCopy("en").state;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const draw = async (savedAt?: string) => {
  await render(
    <ThemeProvider mode="light">
      <ResourceList
        presentation={presentation}
        entry={note}
        rows={[]}
        total={0}
        loading={false}
        refreshing={false}
        more={false}
        error=""
        {...(savedAt === undefined ? {} : { savedAt })}
        order={noOrder}
        onOrder={none}
        onOpen={none}
        onMore={none}
        onRefresh={none}
        onNew={none}
      />
    </ThemeProvider>,
  );
};

test("an empty page the phone answered says the device is offline rather than that nothing exists", async () => {
  await draw("2026-10-07T08:30:00.000Z");
  expect(screen.getByText(words.offline.title)).toBeOnTheScreen();
  expect(screen.getByText(new RegExp(`^${escape(words.updatedAt(""))}`))).toBeOnTheScreen();
  expect(screen.queryByText("No notes yet")).toBeNull();
});

test("an empty page the server answered is still the collection having nothing in it", async () => {
  await draw();
  expect(screen.getByText("No notes yet")).toBeOnTheScreen();
  expect(screen.queryByText(words.offline.title)).toBeNull();
});

test("the line a stored page carries offers the read again", async () => {
  const onRefresh = jest.fn<() => void>();
  await render(
    <ThemeProvider mode="light">
      <ResourceList
        presentation={presentation}
        entry={note}
        rows={[]}
        total={0}
        loading={false}
        refreshing={false}
        more={false}
        error=""
        savedAt="2026-10-07T08:30:00.000Z"
        order={noOrder}
        onOrder={none}
        onOpen={none}
        onMore={none}
        onRefresh={onRefresh}
      />
    </ThemeProvider>,
  );
  await fireEvent.press(screen.getByRole("button", { name: words.retry }));
  expect(onRefresh).toHaveBeenCalledTimes(1);
});
