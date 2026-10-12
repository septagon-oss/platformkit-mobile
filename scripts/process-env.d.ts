// `process.env`, as the two halves of this program actually see it.

// One `tsc -p tsconfig.json` checks the app and the Node tooling together, and the
// ambient types Expo contributes describe the app alone: they declare `NODE_ENV` a
// property every process has. That is true inside a Metro bundle, where the bundler
// writes the constant in, and false for a Node process, which has it only when the
// environment was set — Node's own typings say so, its `ProcessEnv` is a plain
// dictionary. The difference bites whoever starts a process with an environment of
// its own, which is how the e2e harness and the suites run a tool: the missing
// variables are the point of the run, and a type that demands `NODE_ENV` asks for one
// the run deliberately does not carry. Redeclaring it optional states Node's truth;
// the union stays Expo's, so a read is still no plain string.

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** What a Metro bundle writes; a process that was not given it has no value. */
      NODE_ENV?: "development" | "production" | "test";
    }
  }
}

export {};
