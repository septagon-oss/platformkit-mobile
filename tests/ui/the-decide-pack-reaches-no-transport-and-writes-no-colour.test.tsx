// The decide pack is props in and elements out: it reaches no transport or secure storage
// (`src/effects/`) and draws no colour of its own (the palette is `src/ui/theme.tsx`).
import { describe, expect, it } from "@jest/globals";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const dir = join(__dirname, "..", "..", "src", "packs", "decide");
const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f));

describe("the decide pack", () => {
  it("has screens to read", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s imports no transport or secure storage", (file) => {
    expect(readFileSync(join(dir, file), "utf8")).not.toMatch(/from ["'][./]*(?:\.\.\/)*effects\//);
  });

  it.each(files)("%s writes no colour of its own", (file) => {
    expect(readFileSync(join(dir, file), "utf8")).not.toMatch(/#[0-9a-fA-F]{6}\b|rgba?\(/);
  });
});
