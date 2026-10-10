# Changelog

The changes each published version of the kit makes available to the client
applications that pin it. A release is cut from the tag `kit-v<version>`, which
has to name the version in [package.json](package.json); the entry below for that
version is the one the publish job reads, and `npm run check:publish` refuses a
manifest version with no entry here, or an entry that states a catalogue version
this build does not render.

Below `1.0.0` the minor carries breaking changes to an exported subpath; from
`1.0.0` a breaking change to any `exports` entry is a major. Below a published
1.0.0 there is no consumer with a version to break from, so that is the share the
minor carries; the rule the first release plan stated in other words — a breaking
change to an export is a major — takes effect with the first `1.0.0` release.
Every entry names the catalogue version the release renders, because that is what
decides whether a server's document can be drawn at all; an entry for a version
that was never published states none, and `check:publish` reads only the section
for the version being released.

## 0.3.0 (unreleased)

- catalogVersion: 2
- `detailItems` is gone from `./core/derive`, which is a breaking change to a published
  subpath: below 1.0.0 the minor carries that, so the removal is documented here rather
  than noted under `0.2.0`, and `package.json` moves to `0.3.0` when the cut is made.
  `recordHeader`, `recordSections` and `recordInformation` answer the question it used to
  — which facts a record draws — as three levels instead of one flat list of every
  non-hidden field, which is what let a record open on its own identifier.
- New in the same subpath, additive: `hasValue` (the one emptiness rule a record reads
  a row with), `informationFields` (the identifier and the two stamps, named once) and
  the section model itself; `record-menu` and `record-information` are the two ids a
  journey finds a record's header menu and its collapsed block by.

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

- catalogVersion: none.

Never published. The kit set `"private": true` and every consumer depended on an
HTTPS archive of one commit; that is the state this release ends. No version was
offered to a consumer, so this entry states no catalogue version: the range of
commits that carried `0.1.0` is wider than any one release.
