import React from "react";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { View } from "react-native";
import { kitExamples } from "../../src/core/derive";
import { MediaHero } from "../../src/ui/molecules/MediaHero";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test.each(["default", "loading", "error"])(
  "the %s media specimen exposes only actions its content can perform",
  async (state) => {
    const result = kitExamples(presentation, `media-hero/${state}`);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    const model = result.value.hero;
    const open = jest.fn();
    const action = jest.fn();
    const retry = jest.fn();
    await render(
      <ThemeProvider mode="light">
        <MediaHero
          model={model}
          renderImage={() => <View />}
          onOpen={open}
          onAction={action}
          onRetry={retry}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText(model.title!)).toBeTruthy();
    const details = screen.queryByRole("button", { name: presentation.copy.kit.details });
    const opening = screen.queryByRole("button", {
      name: `${model.item.openLabel}: ${model.item.description}`,
    });
    if (state === "default") {
      expect(details).toBeTruthy();
      expect(opening).toBeTruthy();
      await fireEvent.press(details!);
      await fireEvent.press(opening!);
      expect(action).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledWith(model.item.id);
    } else {
      expect(details).toBeNull();
      expect(opening).toBeNull();
      expect(action).not.toHaveBeenCalled();
      expect(open).not.toHaveBeenCalled();
    }
    if (state === "error") {
      expect(screen.getByText(model.item.reason!)).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: model.item.retryLabel }));
      expect(retry).toHaveBeenCalledWith(model.item.id);
    } else {
      expect(screen.queryByRole("button", { name: model.item.retryLabel })).toBeNull();
      expect(retry).not.toHaveBeenCalled();
    }
  },
);
