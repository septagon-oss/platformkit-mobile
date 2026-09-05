# Working in this repository

The public repository's rules apply unchanged — read its `AGENTS.md` and
`ARCHITECTURE.md` (github.com/septagon-oss/platformkit): make changes easy to
understand and maintain, no new channel, one task one commit green build,
remove replaced implementations in the same change, keep scope bounded, verify
before claiming, never commit secrets, one implementation per rule, contracts
before implementations.

And this repository's own:

- The core (`src/core`) imports nothing from React or React Native and is
  tested in plain Node (`tsx --test`). Its functions are pure.
- Effects live in `src/effects`: fetch, the secure store, and nothing else.
- A screen is a component of props. It reads no global, registers nothing.
- Route files (`app/`) compose and render nothing of their own.
- Custom screens arrive as a renderer pack passed to `<Shell>` once.
- `npm run check` passes before every commit.
