# platformkit-mobile

PlatformKit Mobile is an Expo and React Native client for
[PlatformKit](https://github.com/septagon-oss/platformkit). It signs in to a
running server, reads `GET /api/v1/admin/resources`, and derives list, detail,
create and edit screens from the resources returned for that session. The
server remains responsible for authorization and validation on every request.
This repository builds independently; it has no build-time dependency on the
Go repository or on private modules.

## Run locally

Install Node.js and npm, then run these commands from this repository:

```sh
npm install
npm run check
EXPO_PUBLIC_API_URL=https://platformkit.example.com npm start
```

Replace the example URL with the tenant's server origin, without an `/api/v1`
suffix. The sign-in screen also lets you enter or change the server URL. Use
an existing account on that tenant. To start a local reference server, follow
the [PlatformKit quick start](https://github.com/septagon-oss/platformkit#readme).
The device must be able to reach the server; `localhost` on a phone refers to
the phone itself. `EXPO_PUBLIC_API_URL` is bundled client configuration and
must contain no secret.

`npm start` starts Expo's development server. `npm run android` and
`npm run ios` build and run native projects using the corresponding local
platform toolchain. `npm run web` starts a browser preview, but the current
session transport is native: it reads `Set-Cookie` and sends `Cookie`
explicitly. Browser cookie restrictions make that preview unsuitable as proof
that sign-in works on a device.

## Find the owner of a change

`app/_layout.tsx` supplies the server URL and renderer pack to `Shell` and keeps
the route stack inside the device's safe area.
`src/shell.tsx` owns session restoration, sign-in, sign-out and catalog loading.
The resource route files delegate to `src/route.tsx`, which finds the catalog
entry and chooses a custom or generated screen.

`src/core/` holds the catalog types and validator, screen derivation and
lifecycle reducer. These functions run in plain Node without React.
`src/effects/api.ts` owns HTTP requests and API error decoding;
`src/effects/session.ts` orders secure-storage operations and binds the server
URL and session cookie in one versioned record. `src/effects/native-session.ts`
supplies Expo SecureStore. Each shell operation has a generation; the core
rejects obsolete responses after sign-out, another sign-in or a newer refresh.
`src/screens/` renders the generated screens, manages local form
state and calls the shell's API for record operations. It does not define a
second transport or a second resource registry.

Only the current atomic session record is supported. Older installations require
a fresh server selection and sign-in. Failed saves
prevent sign-in completion. Sign-out immediately clears the active client;
if secure storage cannot be cleared, the sign-in screen reports the failure
and provides a retry. Until clearing succeeds, reopening the app may restore
the previous saved record.

A custom screen belongs in the renderer pack passed to `Shell` in
`app/_layout.tsx`. The [Renderers type](src/renderers.ts) maps `module/entity`
to optional `list`, `detail` and `form` components. Each receives an `entry`
and, when applicable, an `id`; any omitted component falls back to the
generated screen. Add a custom screen when the workflow needs something the
resource schema cannot express.

## Verify a change

The repository CI runs `npm run check` on pull requests and main pushes.
`npm run check` checks package compatibility with the installed Expo SDK, then
runs TypeScript, ESLint, the source formatting check, the Node tests and the
native fingerprint check. [fingerprint.json](fingerprint.json) is the hash of
everything a binary is built from: the app configuration, the native modules in
the lockfile and their config plugins. When a change moves it, run
`npm run fingerprint` and say why in the commit, because that change needs a
new binary. CI also exports both bundles, fails on a high or critical dependency
advisory, and scans the history for secrets; a weekly workflow reports what
drifted without blocking anything. Node is pinned once, in [.nvmrc](.nvmrc).
Use `expo install` for native dependencies so they match that SDK; the app owns
the native font dependency used by its router. Starting Expo generates route
types under the ignored `.expo/` directory, which TypeScript also checks.
The individual commands are in [package.json](package.json).
`npm run format` formats TypeScript in `app/`, `src/` and `tests/`.

The tests cover catalog parsing, screen derivation, out-of-order lifecycle
events, interrupted storage writes and HTTP behavior with supplied effects.
They do not launch Expo,
exercise a native device or connect to a live server. For a screen or session
change, also exercise the affected journey on the target platform and report
what you ran.

[testdata/catalog.json](testdata/catalog.json) is a checked-in copy of
PlatformKit's `ui/screens/testdata/catalog.json`. The tests validate this local
fixture; they do not fetch upstream changes. When the catalog contract changes,
compare both files, update the copy deliberately, and run the checks in both
repositories. Read [AGENTS.md](AGENTS.md) before contributing.
