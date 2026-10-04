// Component and hook tests: React Native's sources need the Expo preset's
// transforms and mocks, which the plain Node suite
// (node --import tsx --test tests/*.test.ts) neither has nor wants. The two
// suites discover different files: Jest takes
// every .test.tsx under tests/ (the UI layers, the shell, the route dispatcher
// and the screen hooks), Node the .test.ts files beside them.
module.exports = {
  preset: "jest-expo",
  // Preserve Expo transforms while compiling the pure ESM geometry packages.
  transformIgnorePatterns: require("jest-expo/jest-preset").transformIgnorePatterns.map((pattern) =>
    pattern.includes(".pnpm|") ? pattern.replace(".pnpm|", ".pnpm|d3-|internmap|") : pattern,
  ),
  testMatch: ["<rootDir>/tests/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/tests/ui/setup.tsx"],
  // One worker, whatever the machine reports. Jest sizes its pool from the CPU
  // count (maxWorkers defaults to half of os.availableParallelism()), and a
  // React Native suite costs ~0.5 GB, so 46 suites in a wide pool need ~8.8 GB
  // and the memory killer takes the workers instead: CI run 45982 lost 26 of 46
  // suites to `A jest worker process … was terminated by another process:
  // signal=SIGKILL` with no failed assertion. Measured here, the single-worker
  // pool holds 0.97 GB and the same 46 suites / 232 tests pass in 19 s against
  // 6 s and 8.8 GB for the machine-sized pool.
  maxWorkers: 1,
};
