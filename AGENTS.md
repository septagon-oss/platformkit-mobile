# Working in this repository

Read [README.md](README.md) for setup, the source map and verification limits.
For the server contract, read PlatformKit's
[architecture](https://github.com/septagon-oss/platformkit/blob/main/ARCHITECTURE.md)
and [contribution guide](https://github.com/septagon-oss/platformkit/blob/main/CONTRIBUTING.md).
Use their readability and ownership principles; this repository's required
check is `npm run check`, not the Go repository's Make targets.

Keep derivation, catalog validation, value helpers and lifecycle decisions in
`src/core/`. The core imports neither React nor React Native and has no
external effects. Keep HTTP and secure storage behind `src/effects/`. The
component library in `src/ui/` is props in and elements out: atoms,
molecules, organisms and templates never import the shell, a transport or the
router, and every column, label, control and value they draw comes from
`src/core/derive.ts`; a rule restated in a component is a second
implementation. `src/screens/` is where an effect becomes a prop: one hook
per generated screen owns its requests and its phase, one composition sets
the native header and renders the organism. The shell owns the session, the
catalog lifecycle and the count of what this app wrote to each resource.
Route files compose those pieces and hold no rule. ESLint enforces the import
direction; do not weaken it to make an import fit. Custom resource screens
enter through the renderer pack supplied once to `Shell`; do not introduce
self-registration, a parallel routing registry or a second design system.

Colours and faces come from `src/ui/theme.tsx`, whose palette is generated
from `testdata/design-tokens.json` (the public repository's design export)
by `npm run tokens`; refresh the fixture deliberately, never edit the
generated file, and write no colour elsewhere. Distances are in
`src/ui/scale.ts`. The gallery (`src/ui/gallery.tsx`) shows every atom and
molecule; add a new one there.

`fingerprint.json` is the hash of what a binary is built from. When
`npm run check` reports it stale, run `npm run fingerprint` and say in the
commit why the native project changed; that change needs a new binary. Keep
the device flows in `e2e/flows` naming ids that components set; CI checks
that and nothing more, so a change to a screen is proven on an emulator with
`make e2e-android` and the commit says which flows ran.

Make inputs, state changes and effects visible, and use the capability's domain
language. Preserve one implementation of each rule and remove what a change
replaces. Keep unrelated defects separate. Define changed catalog and API
behavior before implementing it, and use independently chosen examples in the
existing tests. A local fixture is evidence for that fixture, not for every
server release.

Run `npm run check` before each commit. For runtime changes, also verify the
affected journey on the target platform; the Node and component suites do not
exercise a device or a live server. Binaries come from
`scripts/android/build.sh` through `make apk`; there is one recipe, and the
workflows call it. Keep one logical change in one repository per commit,
use a conventional subject, and include real validation output in the commit
body. State any untested behavior explicitly.

This is public source. Keep credentials, session cookies, client identities,
private repository names, deployment details and generated native builds out
of commits, fixtures and examples. Document private consumers only in terms of
the public HTTP contract they consume.
