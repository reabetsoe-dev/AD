import { test } from "node:test";
import assert from "node:assert/strict";
import { translations } from "../lib/translations";

test("public copy presents the platform without proposal or demonstration branding", () => {
  for (const language of ["EN", "ST"] as const) {
    const publicCopy = Object.entries(translations[language])
      .filter(([key]) => key !== "synthetic")
      .map(([, value]) => value);
    assert.doesNotMatch(
      publicCopy.join(" "),
      /\b(proposal|proposed|demonstration|demo|pontšo|sisintsoeng)\b/i,
      language,
    );
    assert.equal(translations[language].platformName, "AD Digital Platform");
  }
});

test("contact copy discloses that message delivery is unavailable", () => {
  assert.match(translations.EN.contactNote, /not sent/i);
});
