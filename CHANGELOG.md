# Changelog

The changes each published version of the kit makes available to the client
applications that pin it. A release is cut from the tag `kit-v<version>`, which
has to name the version in [package.json](package.json); the entry below for that
version is the one the publish job reads, and `npm run check:publish` refuses a
manifest version with no entry here, or an entry that states a catalogue version
this build does not render.

Below `1.0.0` the minor carries breaking changes to an exported subpath; from
`1.0.0` a breaking change to any `exports` entry is a major. Every entry names
the catalogue version the release renders, because that is what decides whether a
server's document can be drawn at all.

## 0.2.0

- catalogVersion: 2
- Expo SDK 57 (`expo@57.0.23`), React Native `0.86.3`, Node `>=22.18.0`.
- Renamed from `platformkit-mobile` to `@septagon-oss/platformkit-mobile`, which
  changes the root of every import specifier a client writes. That is a breaking
  change for a consumer, and the reason this is `0.2.0` rather than `0.1.1`.
- First release published to a registry, from the tag `kit-v0.2.0`. The date the
  tag goes up is recorded here by whoever pushes it.
- No `exports` entry was moved or removed by the rename: every subpath that
  resolved before it resolves to the same source file, which
  [`tests/package.test.ts`](tests/package.test.ts) proves from an installed
  archive. Four subpaths that landed on `main` after `0.1.0`'s tree are
  published for the first time by this release — `./examples/taskRenderers`,
  `./screens/useOperation`, `./screens/useCommand` and `./generated`. The packed
  files are `0.1.0`'s plus this changelog.
- A client pins the exact published version and names the registry in its own
  `.npmrc`; the HTTPS source archive of a commit remains the way to pin a commit
  from before this rename.

## 0.1.0

Never published. The kit set `"private": true` and every consumer depended on an
HTTPS archive of one commit; that is the state this release ends.
