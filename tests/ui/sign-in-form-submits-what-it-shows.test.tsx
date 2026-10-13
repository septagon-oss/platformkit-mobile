// What the sign-in form shows without being asked for is what it submits: a
// returning address resent from the refusal's Retry, a server address the
// caller supplies after the form is drawn, and a value typed and sent in one
// gesture, which a frame drawn from older state must not overwrite.
import { feedback } from "../fakes/presentation";
import { expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { SignInForm, type Props } from "../../src/ui/organisms/SignInForm";
import { ThemeProvider } from "../../src/ui/theme";

const email = "kept@workspace.example";
const none = () => undefined;

function form(props: Partial<Props>) {
  return (
    <ThemeProvider mode="light">
      <SignInForm
        feedback={feedback}
        baseURL="https://first.example"
        notice=""
        busy={false}
        error=""
        onSubmit={none}
        onClear={none}
        {...props}
      />
    </ThemeProvider>
  );
}

test("the refusal's retry resends the returning address the form shows", async () => {
  const onSubmit = jest.fn();
  await render(form({ onSubmit, initialEmail: email, error: "That password is not right." }));
  await fireEvent.changeText(screen.getByTestId("password"), "second try");
  await fireEvent.press(screen.getByRole("button", { name: feedback.retryLabel }));
  expect(onSubmit).toHaveBeenCalledWith("https://first.example", email, "second try");
});

test("a server address supplied after the form is drawn is the address submitted", async () => {
  const onSubmit = jest.fn();
  await render(form({ onSubmit, initialEmail: email }));
  await screen.rerender(form({ onSubmit, initialEmail: email, baseURL: "https://later.example" }));
  await fireEvent.changeText(screen.getByTestId("password"), "pw");
  await fireEvent.press(screen.getByTestId("submit"));
  expect(onSubmit).toHaveBeenCalledWith("https://later.example", email, "pw");
});

test("a password typed and sent in one gesture keeps the shown address beside it", async () => {
  const onSubmit = jest.fn();
  await render(form({ onSubmit, initialEmail: email }));
  await act(() => {
    fireEvent.changeText(screen.getByTestId("password"), "one gesture");
    fireEvent.press(screen.getByTestId("submit"));
  });
  expect(onSubmit).toHaveBeenCalledWith("https://first.example", email, "one gesture");
});
