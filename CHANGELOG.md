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
- A list row now says which record it is, what state that record is in, and what sets it
  apart: `listRow` assembles the title, the record's own line, the declared pill and at
  most two values, and `DataList` draws those values through `Value` and `Labelled` in the
  shapes their types deserve and the pill in the right-hand column `Row` reserves for it.
  `listCells` budgets two values, not three, whoever named them — a declared
  `summaryFields` longer than the line keeps its first two — and never answers the
  identifier, either stamp, or the state the row already wears as its pill: one value is
  drawn once, at the place that owes it.
- `narrowed` is gone from `./core/derive`, which is a breaking change to a published
  subpath: below 1.0.0 the minor carries that. It answered "is anything filtered" and
  "is anything reordered" with one boolean, which is why a list ordered by title and
  holding nothing was called "no matching notes". `filtered`, `reordered` and
  `activeFilters` answer the three questions separately, and the empty state keys on the
  first alone.
- Also in that subpath: `statusPill`, the one reading of `statusField` with its declared
  labels and tones, extracted from `recordHeader` so a record and a row cannot colour one
  value two ways; `sortFields`; and three derivations the list's controls are made of —
  `deriveSortSheet`, `deriveFilterSheet` and `deriveListToolbar`. `sortOptions` now takes
  the reader's `Presentation` and words each direction for the field's own type
  ("Due at, soonest first", "Rank, low to high", "Title, A–Z") in `en` and `pt`, which is
  a change to that function's signature on a published subpath; its values are the wire's
  and do not move. `listPreview` takes the medium (`"row"` or `"record"`) the way `label`
  already did, and honours `hideList` for a row, which retires the exception it documented.
- `./core/catalog` reads one more hint, `sortable`, the same way it reads `summaryFields`:
  a name matching no field of the entry is dropped with a notice, and a list left empty is
  the default rather than "no orders". Additive.
- The `ResourceList` organism drops its `ordering` boolean and gains `sheet` and `onSheet`;
  `DataList` no longer draws the filter and sort chip rows and no longer takes `onOrder`,
  and `useResourceList` returns `sheet`/`setSheet` where it returned `ordering`/
  `toggleOrdering`. These are the sort-and-filter controls moving out of the native header
  and the list's own header into a toolbar row under it, drawn by `ActionBar` and opened by
  two sheets; `ChoiceRows` is the new molecule they are made of, and `Row` gained the role a
  row asks a reader for. Nothing reads `ordering` any more, so nothing writes it.

- Two words the kit was missing, and an id. `kit.listControls` names the toolbar row a
  list's two doors sit in: the bar's accessible name was `kit.sort`, which told a reader the
  bar *is* its Sort button and left the filters door beside it under the wrong name. A
  supplied `testID` now names the `ActionBar` itself as well as every control inside it, so
  the bar a reader hears the name of is a bar a journey can look up. Additive.
- Each group of a filters sheet keys its choices with the group's own name
  (`filters-status/value%3Aopen`), where every group drew `filters/value%3A…`: an entry with
  two closed sets would have put one id on two rows and a journey that taps one would be
  told it found two.

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
