// Component and hook tests: React Native's sources need the Expo preset's
// transforms and mocks, which the plain Node suite (tsx --test tests/*.test.ts)
// neither has nor wants. The two suites discover different files: Jest takes
// every .test.tsx under tests/ (the UI layers, the shell, the route dispatcher
// and the screen hooks), Node the .test.ts files beside them.
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/tests/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/tests/ui/setup.tsx"],
};
