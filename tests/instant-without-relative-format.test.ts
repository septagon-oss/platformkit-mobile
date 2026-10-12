// Hermes on Android has no Intl.RelativeTimeFormat, and `new` on it crashed every record screen that read a recent
// time (2026-10-09, phone 47ab484, "app crashed creating content"). The kit's own words stand in there; this reads
// every distance presentedInstant says with the constructor removed, and expects Intl's own words back.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy, presentedInstant, type Formatting } from "../src/core/derive";

const under = (now: string, language: "en" | "pt", locale: string): Formatting => ({
  copy: deriveCopy(language),
  locale,
  timeZone: "UTC",
  ownZone: "UTC",
  now,
});
const NOW = "2026-07-08T12:00:00Z";
const AT = [
  "2026-07-08T11:59:30Z", // just now
  "2026-07-08T11:59:00Z", // 1 minute ago
  "2026-07-08T11:55:00Z", // 5 minutes ago
  "2026-07-08T11:00:00Z", // 1 hour ago
  "2026-07-08T03:00:00Z", // 9 hours ago
  "2026-07-07T09:00:00Z", // yesterday
  "2026-07-06T09:00:00Z", // two days back
  "2026-07-04T09:00:00Z", // 4 days ago
  "2026-07-09T09:00:00Z", // tomorrow
  "2026-06-20T09:00:00Z", // a date
];

for (const [language, locale] of [
  ["en", "en-US"],
  ["pt", "pt-PT"],
] as const) {
  test(`every distance reads the same without Intl.RelativeTimeFormat (${language})`, () => {
    const withIntl = AT.map(
      (at) => presentedInstant(new Date(at), under(NOW, language, locale)).shown,
    );
    const engine = Intl as unknown as { RelativeTimeFormat?: unknown };
    const original = engine.RelativeTimeFormat;
    try {
      delete engine.RelativeTimeFormat; // the engine on Android has none
      assert.equal(typeof engine.RelativeTimeFormat, "undefined");
      const without = AT.map(
        (at) => presentedInstant(new Date(at), under(NOW, language, locale)).shown,
      );
      assert.deepEqual(without, withIntl);
    } finally {
      engine.RelativeTimeFormat = original;
    }
  });
}
