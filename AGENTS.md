# Working in this repository

Read [README.md](README.md) for setup, the source map and verification limits.
For the server contract, read PlatformKit's
[architecture](https://github.com/septagon-oss/platformkit/blob/main/ARCHITECTURE.md)
and [contribution guide](https://github.com/septagon-oss/platformkit/blob/main/CONTRIBUTING.md).
Use their readability and ownership principles; this repository's required
check is `npm run check`, not the Go repository's Make targets.

Keep derivation, catalog validation and lifecycle decisions in `src/core/`.
The core imports neither React nor React Native and has no external effects.
Keep HTTP and secure storage behind `src/effects/`; screens call those
capabilities through the existing shell. The shell owns the session and catalog
lifecycle, while screens own local interaction state. Route files compose those
pieces. Custom resource screens enter through the renderer pack supplied once
to `Shell`; do not introduce self-registration or a parallel routing registry.

Make inputs, state changes and effects visible, and use the capability's domain
language. Preserve one implementation of each rule and remove what a change
replaces. Keep unrelated defects separate. Define changed catalog and API
behavior before implementing it, and use independently chosen examples in the
existing tests. A local fixture is evidence for that fixture, not for every
server release.

Run `npm run check` before each commit. For runtime changes, also verify the
affected journey on the target platform; the Node suite does not exercise a
device or a live server. Keep one logical change in one repository per commit,
use a conventional subject, and include real validation output in the commit
body. State any untested behavior explicitly.

This is public source. Keep credentials, session cookies, client identities,
private repository names, deployment details and generated native builds out
of commits, fixtures and examples. Document private consumers only in terms of
the public HTTP contract they consume.
