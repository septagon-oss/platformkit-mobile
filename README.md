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

`app/_layout.tsx` supplies the server URL and renderer pack to `Shell`.
`src/shell.tsx` owns session restoration, sign-in, sign-out and catalog loading.
The resource route files delegate to `src/route.tsx`, which finds the catalog
entry and chooses a custom or generated screen.

`src/core/` holds the catalog types and validator, screen derivation and
lifecycle reducer. These functions run in plain Node without React.
`src/effects/api.ts` owns HTTP requests and API error decoding;
`src/effects/session.ts` stores the server URL and session cookie through Expo
SecureStore. `src/screens/` renders the generated screens, manages local form
state and calls the shell's API for record operations. It does not define a
second transport or a second resource registry.

A custom screen belongs in the renderer pack passed to `Shell` in
`app/_layout.tsx`. The [Renderers type](src/renderers.ts) maps `module/entity`
to optional `list`, `detail` and `form` components. Each receives an `entry`
and, when applicable, an `id`; any omitted component falls back to the
generated screen. Add a custom screen when the workflow needs something the
resource schema cannot express.

## Verify a change

`npm run check` runs TypeScript checking, ESLint, the source formatting check,
and the Node tests. The individual commands are in [package.json](package.json).
`npm run format` formats TypeScript in `app/`, `src/` and `tests/`.

The tests cover catalog parsing, screen derivation, lifecycle transitions and
HTTP behavior with a supplied fetch implementation. They do not launch Expo,
exercise a native device or connect to a live server. For a screen or session
change, also exercise the affected journey on the target platform and report
what you ran.

[testdata/catalog.json](testdata/catalog.json) is a checked-in copy of
PlatformKit's `ui/screens/testdata/catalog.json`. The tests validate this local
fixture; they do not fetch upstream changes. When the catalog contract changes,
compare both files, update the copy deliberately, and run the checks in both
repositories. Read [AGENTS.md](AGENTS.md) before contributing.
