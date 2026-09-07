// Component tests only: React Native's sources need the Expo preset's
// transforms and mocks, which the plain Node suite (tsx --test tests/*.test.ts)
// neither has nor wants. The two suites discover different files.
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/tests/ui/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/tests/ui/setup.ts"],
};
