import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
import { useResourceDetail } from "../../src/screens/useResourceDetail";
import { useResourceForm } from "../../src/screens/useResourceForm";
import { confirm } from "../../src/ui/chooser";
import { reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

// A door is drawn where `writable` and `operations` agree, and never where only
// one of them does. Hiding the door is half the rule; this is the other half:
// a write screen reached by a link, a restored stack or a notification sends
// nothing at all for a verb the resource does not mount, and says so. A request
// to an address the server never mounted is not a slow failure, it is a wrong
// thing to send, and `wrote` must not count it.

const asked = jest.mocked(confirm);
const api = fakeApi();

beforeEach(() => {
  reset();
  api.create.mockClear();
  api.remove.mockClear();
  asked.mockClear();
  shell.value = shellValue(api);
});

test("a sheet reached for a verb the resource does not mount sends nothing", async () => {
  const noCreate: Entry = { ...note, operations: ["list", "read", "update", "delete"] };
  const { result } = await renderHook(() => useResourceForm(noCreate, undefined));
  await act(async () => {
    await result.current.save();
  });
  expect(api.create).not.toHaveBeenCalled();
  expect(shell.value!.wrote).not.toHaveBeenCalled();
  expect(result.current.phase).toBe("editing");
  expect(result.current.detail).toBe("This record cannot be created here.");
});

test("a remove asked for on a resource with no delete asks no question", async () => {
  const noDelete: Entry = { ...note, operations: ["list", "read", "create", "update"] };
  const { result } = await renderHook(() => useResourceDetail(noDelete, "1"));
  await act(async () => {
    result.current.remove();
  });
  expect(asked).not.toHaveBeenCalled();
  expect(api.remove).not.toHaveBeenCalled();
  expect(result.current.error).toBe("This record cannot be deleted here.");
});
