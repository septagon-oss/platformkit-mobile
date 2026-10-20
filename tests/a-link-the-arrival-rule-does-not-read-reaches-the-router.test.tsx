// A link the arrival rule does not read reaches the router as it arrived. expo-router hands
// every URL the platform opened the app with to `redirectSystemPath` and routes what it
// returns: on a warm start it calls its listener only `if (href)`, and on a cold start the
// returned value *is* the initial URL. So "leave the link alone" is spelled by returning it,
// and an answer of nothing drops the link — the gallery and the command journeys open
// `platformkit://` links that are not under the workspace's surface.
import { expect, jest, test } from "@jest/globals";
import { redirectSystemPath } from "../app/+native-intent";

jest.mock("expo-linking", () => ({ collectManifestSchemes: () => ["platformkit"] }));

const opened = (path: string, initial: boolean) => redirectSystemPath({ path, initial });

test("a link to the workspace's surface still opens the record it names", () => {
  expect(opened("platformkit://app/note/notes/7", false)).toBe("/note/notes/7");
  expect(opened("https://platformkit.example/app/note/notes/7", true)).toBe("/note/notes/7");
});

test("a scheme link outside the workspace's surface reaches the router, warm or cold", () => {
  for (const initial of [false, true]) {
    const gallery = opened("platformkit://gallery", initial);
    expect(typeof gallery).toBe("string");
    expect(gallery).toMatch(/gallery$/);
    const page = opened("platformkit://gallery/table", initial);
    expect(typeof page).toBe("string");
    expect(page).toMatch(/gallery\/table$/);
    const command = opened("platformkit://note/notes/run/archive", initial);
    expect(typeof command).toBe("string");
    expect(command).toMatch(/note\/notes\/run\/archive$/);
  }
});
