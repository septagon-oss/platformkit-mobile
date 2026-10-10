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
- A form now keeps what the person typed and says exactly what to fix, and the rules
  behind it are exported. `problems` refuses a required field left empty (a switch, which
  always answers, and a value nobody may fill aside) and answers every refusal in a
  sentence, so `FormWords` gains `fieldRequired`, `fieldChoiceRequired`, `fieldNumber`
  and `fieldTime` — a breaking change to that interface in name only for anyone who
  implemented it, which nothing outside this repository does, and the two wire fragments
  it used to return ("is not a number", "is not a time") are gone. New in the same
  subpath, additive: `changedFields` (the controls whose effective value differs from the
  row's — what a discard guard asks), `firstProblem` (the first control in the sheet's own
  asked order that carries a sentence) and `writeControls` (the body of a whole-row
  replace: the drawn fields plus the writable ones the sheet was never shown, and never
  the server's own `id`, `createdAt` or `updatedAt`). Ten sentences joined the copy table
  in both languages: the four above, plus `discardChanges`, `discardUnsaved`,
  `keepEditing`, `discard`, `created` and `changesSaved`.
- `ShellValue` gains `say(href, sentence)` and `heard(href)`: one sentence for one
  address, said by the screen that wrote and heard once by the screen that lands there,
  because a confirmation cannot live in a sheet that is on its way out. `ResourceDetail`
  takes the matching `saved?: string` prop and draws it as an `ok` `Notice` with a polite
  live region. The sentence belongs to the visit it was heard in: a focus that hears
  nothing draws nothing, so a record is never still saying what some earlier write did.
- `ResourceForm` (organisms) takes `awaiting?: string` and performs it — the ref of that
  field's box, focused, and asked of React Native to be brought above the keyboard — and
  `refusals?: number` beside it, the count of refusals the sheet has announced, which is
  what makes a second refusal of the same field a new request for the box; `Screen`
  (templates) takes the optional `scrollViewRef` that makes the scroll view
  reachable, which is a handle and no rule. A singleton's Edit is drawn only once its row
  has been read, and its Save rechecks the same thing from inside. One dismissal asks one
  question: a sheet's Cancel answers its own "Discard changes?" by lifting the
  `usePreventRemove` guard in a render before it departs, so the stack does not hand the
  same departure back to the guard and ask the person twice.

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
- A form asks only what a person can answer, and says so in words. `./core/derive` gains
  `formSections` (the fields a form keeps, grouped by the entry's declared `sections` and
  ordered within each block by the field the record is called by, then required, then
  optional), `commandSections` (the same for a command's argument, which has no identity
  field to lead on), `orderControls` (that order over any control list), `joinList` (the
  one spelling a comma-joined field knows), `entryHoldsSeparator` (an entry the box
  cannot honour) and `valueHoldsSeparator` (a held value that does not spell its own
  items); `FormBlock` and `FormWords` are their shapes. Additive. `formControls`, `values`
  and what a body carries are untouched: a reordered sheet writes the same request, which
  the cases assert both ways.
- `problems` now takes the reader's own kit bundle as a third argument, which is a change
  to that function's signature on a published subpath: the sentence it refuses a list with
  is a word, and a core that spelled it in English would be a second implementation of the
  copy table. Its values are unchanged for every field but a list holding a comma inside
  one item, which is refused as itself (`commaInValue`) rather than as an item-type error.
- The `ResourceForm` organism takes `blocks` where it took `controls`, and `FormField`
  marks a field with the reader's own `Required`/`optional` word where it drew an asterisk
  — both changes to published subpaths, which the minor carries. `SwitchRow`, `ChoiceRow`
  and `DateTimeRow` no longer print a label of their own (the name above the control is
  that label, and one control now says it once, in the announcement as on the screen);
  `SwitchRow` drops the `help` line it duplicated, and the three take the announced `name`
  the sheet composes. `TagsField` requires `copy`, commits a word on Return or Add, ignores
  a word already on the sheet, and refuses an entry holding the separator with the text
  left where the person typed it.
- `sheet` in `./route` is titled from the catalogue's declared name for the kind rather
  than from the wire word in the address, and takes the words over that name from the copy
  table; it now asks for the shell's `entry` lookup instead of a prefix string. A sheet
  whose entry has not been read yet still answers the address's word.
- Five words joined the kit table in English and Portuguese — `editNamed`, `addTag`,
  `addTagTo`, `removeTag`, `commaInValue` — and `tags-<label>`, `add-<label>`,
  `tags-fault-<label>` and `field-<name>` are the ids a device journey works through.
- The refusal a person can correct now survives the correction. `TagsField` draws its
  chips from the value beyond the word the box last *wrote*, not beyond whatever stands
  in the box, so a word typed, refused and mended lands alone instead of beside its own
  accepted prefix, and a chip's remove button keeps that word out of the value. In
  `./core/derive`, `entryHoldsSeparator` asks the text for a comma rather than asking
  splitting how many words it would leave, so `alpha,`, `,alpha`, `,` and `alpha,,` are
  refused as `alpha,beta` is — the answer changes for any text holding a comma that
  splitting would leave as one word or none, and for no other input. Additive to the molecule's props: `TagsField` takes the optional
  `announce`, the accessible name the sheet derived (`Tags, Required`), which a box
  standing outside a form has none of and so falls back to its own. Two sentences left
  the derivation for the table — `control` now returns the author's `hints.help` and
  nothing else, and `changedByCommand` and `identifierOnly` (English and Portuguese) are
  drawn by `ResourceForm` — so what an English phone reads beside a greyed-out value is
  the same sentence as before, and a Portuguese phone reads one for the first time.

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
