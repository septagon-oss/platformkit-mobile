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

- The derivation layer has five doors. `./core/list` (which fields a page draws, in
  what order, under which filters), `./core/record` (what one record shows and where
  its address is), `./core/form` (what a person types and what the phone sends),
  `./core/command` (what a person may do here and where the request goes, with the
  failure the server answered) and `./core/present` (how a value, a word, a tone and
  a state read) are new subpaths, and the layer gate now refuses anything but a
  door's own `index.ts` under a door. `./core/derive` stays, publishing every name it
  always published, and is `@deprecated`: import the door your rule lives in. Two
  names that met inside the barrel are told apart — `Control` is a field's editor
  (`./core/form`), and the drawn action it was also called is `ActionModel`
  (`./core/shared`), with the old name kept as a deprecated alias. Nothing is removed
  in this release; the release that removes `./core/derive`, the alias and
  `Notice`'s `retry` re-export lists them in its own entry.

- Every sentence a person reads is a key in the copy table. Two published rules change shape
  for it: `verbRefusal(verb, copy)` takes the bundle its caller already holds, and
  `since(at, now, format, words)` takes the distance words with it. `Copy.failure` gains
  `cannotCreateHere`, `cannotEditHere`, `cannotDeleteHere`, `notAvailableHere`, `entryMissing`,
  `commandNotRun` and `signInElsewhere`, and `KitWords` gains `listItemType`; the distances are
  the kit's own `justNow`/`minuteAgo`/`minutesAgo`/`hourAgo`/`hoursAgo`/`yesterday`/`daysAgo`,
  which a phone already spelled for a recent instant. A sheet that refused a verb, a field that
  held a list item of the wrong type, an activity line's "how long ago" and the question that
  throws a command's arguments away answered in English whatever the person spoke. The rule is
  kept by a lint with its allow list in its own file
  (`tests/copy-names-every-sentence-a-person-reads.test.ts`).


- A record can be kept. A source entry declares `presentation.saved` (the word to keep a copy
  with, the word for a copy kept, the word that names it taken away, and `listEntry`, the entry
  holding this person's copies), the entry holding the copies declares
  `presentation.availabilityField`, and every member the kit cannot carries names itself through the
  notice sink the catalogue read was given. `./core/saved` is a new subpath — `AVAILABILITY`,
  `savedAvailability`, `savedRef`, `saveBody`, `unsaveBody`, `sourceRef`, `expectedSourceVersion`,
  `isKeeping`, `savable`, `savedCopy` — and `./effects/saved` a second, holding `SavedPort`,
  `SavedFinder`, `SavedDeps`, `KeptAnswer` and `createSaved`: a keep that finds no network joins the
  existing queue with its own body and idempotency key, and a removal is never queued at all.
  `Shell` takes an optional `saved` read and draws no heart anywhere without it; `useSaveToggle`
  asks on mount and on focus, one press per record, and never optimistically; `SaveButton` is the
  heart, in the gallery. `listRow` now reads the availability field, so a copy whose source went is
  drawn in the theme's muted ink with "No longer available." under its name, a copy whose provider
  is down says "Temporarily unavailable.", both still openable, and neither is ever collapsed into
  the other. The two keeping writes are withheld from every form, question and swipe by the argument
  each carries. `Api` gained `notice`, `Row` a `muted` tone, `Icon` `heart`/`heartFilled`,
  `Presentation.kit` two sentences in both languages, and the ids `saved-heart` and
  `saved-heart-pressed`.

- A list row can be swiped to run the command its entry names. The author says which
  with `hints.primaryCommand` — a verb the entry offers for a record, one the server
  declared, that asks for no value — and the kit reads it once at mount and says nothing
  else about it, so a client can promise the gesture in its copy before the next server
  release adds the verb. `derive.rowAction` answers which command a row would run and in
  whose tone, `derive.readSwipe` answers how far a drag has got, and both readings are
  the same ones the reanimated surface and the component fake use, so the line a person
  can see is the line a release runs at and no surface gets to decide it twice. The run
  goes through the submit every other door uses, and a command that hurts, or whose
  consequence the author declared, is asked first. Nothing a swipe can do is swipe-only:
  `Row` offers the same command as a named accessibility action, and a list draws its
  rows unchanged when the app supplies no surface. Added to `./core/derive`: `rowAction`,
  `rowSwipeTone` and `RowAction`; the new subpath `./core/gesture` answers `readSwipe` and
  `SwipeRead`, so an app that draws its own reveal surface reads a drag the way this one
  does; `MediaRenderers` gains `rowAction`, `./ui/scale` gains the `swipe` distances, and
  the `command-*`, `row-reveal` and `snackbar` ids are what a journey finds these by.
- Declared composed pictures use the in-memory sign-in session and render received
  SVG in the existing image adapter; failed reads use the empty picture. Restored
  bearer-only connections need a fresh sign-in for these pictures.
- catalogVersion: 3
- `detailItems` is gone from `./core/derive`, which is a breaking change to a published
  subpath: below 1.0.0 the minor carries that, so the removal is documented here rather
  than noted under `0.2.0`, and `package.json` moves to `0.3.0` when the cut is made.
  `recordHeader`, `recordSections` and `recordInformation` answer the question it used to
  — which facts a record draws — as three levels instead of one flat list of every
  non-hidden field, which is what let a record open on its own identifier.
- Home greets the person and counts what the installation answers. The API pin moves to
  the kernel commit that serves `GET /api/v1/app/summary`, which is what makes the door
  askable at all (`documented()` refuses a path the document does not print). New in
  `./core/derive`, additive: `statCards`/`rowCounts`/`StatCardModel`/`cardLimit` (the join
  between that body and the catalogue — an absent number stays absent, so a card and a row
  count never invent a zero), `greeting`/`firstName` (the part of day in the reader's zone
  and the one word a name may be greeted by), `workspaceName`, `civilHour`, and
  `EntryHints.highlight`, the declared word a sub-count needs. `./ui/molecules/StatCard` is
  new; `StatTile` gains `framed` and `Sparkline` gains `height`/`decorative`, each optional
  and each defaulting to the bytes every existing caller already passed; `theme.tsx` gains
  `surface.band` and its two contrast pairs. Home also remembers: `./core/recents` and
  `./effects/recents` are new subpaths — `Recent`/`RecentRef`/`RecentDoor`/`recentHref`/
  `RECENT_SHOWN`/`RECENT_KEEP` and `createRecents` over a `recent_open` table keyed by
  server and sign-in (five shown, twenty kept, pruned in the insert, and a record this phone
  deleted withdrawing its row), beside the outbox and read-cache subpaths they are modelled
  on. Two breaking changes, both below 1.0.0 and both carried by the minor: `ShellValue.recents`
  is a member a host reading it must handle, and `ShellProps.store` now takes a `recents`
  table beside `outbox` and `reads`, so a host that supplies its own store object supplies the
  third table too — absent, as before, where no store is supplied at all. `ListScreen`
  gains the optional `groupTitle`/`groupTestID`, so a grouped page names its one card
  through the group instead of drawing a second heading beside it.
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
  row's — what a discard guard asks, compared as what a value means rather than as how it
  is spelled, so confirming the instant the row already held or flicking a switch back off
  is no change), `firstProblem` (the first control in the sheet's own
  asked order that carries a sentence) and `writeControls` (the body of a whole-row
  replace: the drawn fields plus the writable ones the sheet was never shown, and never
  the server's own `id`, `createdAt` or `updatedAt`). `Control` gained the optional `echo`,
  which is the row's own value for a field nobody is asked to type — a hidden one, a frozen
  one — and which `values` sends back unparsed, because an editor's one-string spelling has
  no way to hold a list item carrying a comma, an item of padding or an empty one, and a
  whole-row replace that re-spells what it was never shown rewrites the row. Ten sentences
  joined the copy table in both languages: the four above, plus `discardChanges`, `discardUnsaved`,
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
  bar _is_ its Sort button and left the filters door beside it under the wrong name. A
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
  chips from the value beyond the word the box last _wrote_, not beyond whatever stands
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
- A picture in a rich text body may come from the phone itself. `Image` over an editable
  `widget: richtext` box now asks where the picture comes from — this phone's camera, its
  photo library, or a file the server already holds — and a picture taken or chosen here is
  stored first: `./effects/api` gains `upload(e, form, query)`, the one multipart POST the
  pinned document gives a file's bytes, answered with the row the server made, so the line
  that enters the body points at that row and never at an address only this phone can read.
  This needs a native module the kit did not carry: `expo-image-picker` is a new dependency,
  and a client that pins this release gets a new native project and therefore a new binary.
  A formatting mark is applied to the body the box shows rather than to whatever the sheet
  happens to hold, and an answer that arrives after the person typed again is inserted into
  the draft as it now stands: a mark over a freshly read body no longer writes `****` over
  the body, and a figure no longer erases the sentence typed while its file was being listed.
- Additive to `./core/derive`: `servedLanguage` (the language the server says one field's
  words arrived in, read off `_i18n`) and `writeLanguage` (what a sheet's Save may name, and
  which of its changed fields that language cannot carry). A save of a translated field now
  sends `?lang=` with it, because a PATCH that names no language writes the record: without
  this, editing Portuguese on a Portuguese phone overwrote the English it was translated
  from. `Api.update` takes the language on its request options, and a held write replays at
  the same address it was filed under.
- Additive to `./effects/api`: `served(e, id)`, which is `get(e, id)`'s read keeping the tag that
  read's `Content-Language` printed beside the row rather than dropping it (`Api.get` answers the
  row alone, unchanged). A record with a translatable field is answered _in a language_, and a
  write naming none is filed as the record's own copy, so the tag a person read their words in is
  the tag their Save names: `writeLanguage` takes it as a fifth, optional argument, and a sheet
  that read a record in Portuguese now writes every translatable field it changed in Portuguese —
  including the complete translation `_i18n` says nothing about, because there is nothing to say,
  and the fallback whose note names English precisely because Portuguese has no row and English is
  what the translator was shown to write. Both of those shapes were overwriting the source.
- Additive to `./core/derive`: `saveBody` (the body of one Save: the values a sheet may write at
  the address its language write names). It is what the two rules below are read from, so a sheet
  holds neither: a language write carries the fields that language owns, and a write that names no
  language carries every field except a translatable one that arrived with the row and that nobody
  edited — the record's own address files whatever reaches it as the record's own, so an untouched
  Portuguese body riding along with a title change used to overwrite the English it translates.
  `writeLanguage` now gates on the catalogue's `translatable` before it reads the served tag, so a
  source-only field edited on a translated read is written at the record's own address instead of
  meeting the server's refusal there.
- An upload keeps the form it was given. `upload(e, form, query)` handed that form to the
  generated operation's serializer, which builds one out of an object's entries and so turned a
  form that already existed into a text field named after its own internals: the request carried
  no file part, no filename and no bytes, and the file module refused it. A body that is already a
  multipart form now reaches `fetch` unchanged, which is what lets a picture taken on the phone
  enter a body as the row the server made for it.
- A record now says when it finished, in the words its author served. `./core/catalog` reads one
  more hint, `doneValues`, on the field's `presentation` and refuses to remember a value the field's
  own enum does not hold; `./core/derive` gains `finishedValues` (the subset the entry's
  `statusField` declared), `isFinished` (this row's state against that subset, never against a tone
  or a label), `finishedWord` (the entry's noun and the author's word for the state, in one sentence)
  and `statusTone` (that colour asked without its words, for a mark drawn in it). Additive.
  `enumTones` answers none of these: which values finish and which colour finished wears are the
  kernel's orthogonal pair, and a document that declares nothing finishes nothing.
- `ShellValue` gains three one-shot channels beside `say`/`heard`. `celebrate(href)`,
  `celebrating(href)` and `celebrated(href)` carry the fact that a write this phone made reached a
  record, so the screen holding that record's row can decide whether its state actually crossed into
  one its entry calls finished — a filing says only that this phone wrote, and files no row and no
  value. `surprised(href)` retires the record's one moment per session, and retires it when the
  moment plays: a write that finished nothing leaves the record its moment for the write that does.
  `travelTo(href, frame)` and `travelled(href)` carry the frame of the row a person pressed to the
  record it opens, once, and carry nothing else. Additive.
- New in `./ui/atoms`, and exported: `RolledValue`, a number that changed while the person was
  reading it — a count, a price, a stat — which rolls to its new value inside the line it stood on.
  It draws a string somebody else derived and derives none of its own, rolls only between two strings
  whose changed positions all hold a digit, and reads no rendered value back into a number.
  `Badge` gained the optional `motion`, which changes a pill in place when the state it carries
  moves; absent it swaps at once, so every call site is undisturbed. `ResourceDetail` (organisms)
  gained the optional `finishing` — the sentence, the tone the arrived state wears, the burst to draw
  over the record and the one call that says it is over — absent meaning the record reached nothing
  and is drawn exactly as it was. `MediaRenderers` gained `finishing`, the third renderer a product
  may ship beside `zoom` and `coverMotion`. `kit.finished` joined the copy table in English and
  Portuguese, and `record-finished` is the id a journey and a screen reader both find the line by.

- The app wears each workspace's own face. `GET /api/v1/app/connection` is read at the
  address a person is connecting to and at the one a session opens at, and what it answers
  becomes `./core/workspace`'s `Workspace` (`server`/`host`/`name`/`accent`/`logoPath`) — the name goes
  to `workspaceName`, which now takes the answered word before the address and the copy
  table's word, and the colour goes through the new `accentPalette` in `./ui/theme`, which
  copies the generated palette and wears that colour in its accent roles at the nearest
  shade that keeps every pair `contrastPairs` measures in both modes, refusing the whole
  palette by identity when none does. `src/ui/tokens.ts` is still the only writer of colour.
  `./effects/workspaces` is new — `createWorkspaces` over a `workspace_seen` device table
  (five shown, eight kept, one row per server, `seen_at` from the injected clock), holding a
  server's name and mark and no credential of any kind, and drawn as a row on the address step.
  A face carries the origin it was read from, so its mark is only ever asked of that origin: New on `ShellValue`: `workspace`,
  `lookUp` and the optional `workspaces`, and `ShellProps.store` takes the fourth table
  beside `outbox`, `reads` and `recents` — all three additive, and all three below 1.0.0.
  Sign-in grows an address step before the password asks for one; `./screens/WorkspaceTheme`
  and `./screens/WorkspaceMark` are the new composition units between the shell and the theme.

## 0.2.0

- catalogVersion: 3
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
