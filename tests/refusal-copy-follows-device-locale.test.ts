// Refusals without a catalogue noun still follow the device at the screen
// boundary. Explicit core locales must work without consulting that device.
import assert from "node:assert/strict";
import { test } from "node:test";
import { copyForLocale } from "../src/core/copy";
import { recordSubject } from "../src/core/failure";
import { ApiError } from "../src/effects/api";
import { catalogFailure, refusalOf, screenCopy } from "../src/screens/failure";

test("a Portuguese device supplies the whole refusal when no caller supplies a language", (t) => {
  const options = new Intl.DateTimeFormat().resolvedOptions();
  t.mock.method(Intl.DateTimeFormat.prototype, "resolvedOptions", () => ({
    ...options,
    locale: "pt-BR",
  }));
  assert.equal(
    catalogFailure(new ApiError(402, "HTTP 402")),
    "O plano desta conta não inclui esta área de trabalho.",
  );
  assert.equal(
    refusalOf(new ApiError(503, "HTTP 503"), "read", recordSubject, screenCopy()).text,
    "Não foi possível carregar este registo.",
  );
});

test("an explicit refusal language never asks the device for its language", (t) => {
  t.mock.method(Intl.DateTimeFormat.prototype, "resolvedOptions", () => {
    throw new Error("The device locale is unavailable");
  });
  assert.equal(
    catalogFailure(new ApiError(402, "HTTP 402"), copyForLocale("pt-PT")),
    "O plano desta conta não inclui esta área de trabalho.",
  );
  assert.equal(
    refusalOf(new ApiError(503, "HTTP 503"), "read", recordSubject, copyForLocale("fr-FR")).text,
    "We couldn't load this record.",
  );
});
