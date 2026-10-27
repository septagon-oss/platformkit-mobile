// The way out to another server is one sentence of the copy table drawn by two surfaces: the
// route dispatcher's Notice and this organism. src/ui is outside the copy walk's scope - that
// walk covers src/core and the two product files, and this file's other sentences belong to
// the brief that prices them - so what proves the table reaches this control is the control.
// A session that arrived speaking Portuguese reads Portuguese here; an English session reads
// English. A sentence written into the organism would answer a person who never spoke it.
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { deriveCopy, deriveFeedback } from "../../src/core/derive";
import { SignInForm } from "../../src/ui/organisms/SignInForm";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const none = () => undefined;
const refused = "The saved sign-in could not be opened.";

const askedIn = (language: "en" | "pt") => {
  const copy = deriveCopy(language);
  return render(
    <ThemeProvider mode="light">
      <SignInForm
        feedback={deriveFeedback(copy, "reduced", presentation)}
        baseURL="https://first.example"
        notice=""
        busy={false}
        error=""
        failed={refused}
        onSubmit={none}
        onClear={none}
      />
    </ThemeProvider>,
  );
};

test("the way out to another server is asked in the language the session arrived with", async () => {
  const pt = deriveCopy("pt");
  await askedIn("pt");
  expect(screen.getByRole("button", { name: pt.failure.signInElsewhere })).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Sign in to another server" })).toBeNull();
});

test("the same control asks in English when the session reads English", async () => {
  const en = deriveCopy("en");
  await askedIn("en");
  expect(screen.getByRole("button", { name: en.failure.signInElsewhere })).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: en.kit.discard })).toBeNull();
});
