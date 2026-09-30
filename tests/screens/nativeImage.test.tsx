import React from "react";
import { expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { NativeImage } from "../../src/screens/NativeImage";
import type { ImageSlotProps } from "../../src/core/derive";

jest.mock("expo-image", () => ({ Image: "NativeImageDouble" }));

test("replaced and unmounted image sources cannot report into the active scope", async () => {
  const onState = jest.fn();
  const model: ImageSlotProps = {
    id: "photo",
    description: "Portrait",
    decorative: false,
    fit: "contain",
    aspectRatio: 2 / 3,
  };
  const view = (scope: string, slotId = "photo") => (
    <NativeImage
      model={{ ...model, id: slotId }}
      resource={{ id: "photo", scope, version: "v1", uri: "https://images.example.test/photo" }}
      onState={onState}
    />
  );
  await render(view("first-session"));
  const old = screen.getByLabelText("Portrait").props;
  expect(old.cachePolicy).toBe("none");
  await screen.rerender(view("second-session"));
  old.onLoad();
  old.onError();
  expect(onState).not.toHaveBeenCalled();
  const active = screen.getByLabelText("Portrait").props;
  expect(active.recyclingKey).not.toBe(old.recyclingKey);
  active.onLoad();
  expect(onState.mock.calls).toEqual([["photo", "ready"]]);
  await screen.rerender(view("second-session", "next-photo"));
  active.onError();
  expect(onState).toHaveBeenCalledTimes(1);
  await screen.rerender(view("first-session"));
  old.onLoad();
  expect(onState).toHaveBeenCalledTimes(1);
  const returned = screen.getByLabelText("Portrait").props;
  await screen.unmount();
  returned.onError();
  active.onError();
  expect(onState).toHaveBeenCalledTimes(1);
});
