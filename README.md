# platformkit-mobile

PlatformKit Mobile is an Expo and React Native client for
[PlatformKit](https://github.com/septagon-oss/platformkit). It signs in to a
running server, reads `GET /api/v1/app/resources`, and derives list, detail,
create and edit screens from the resources returned for that session. The
server remains responsible for authorization and validation on every request.
This repository builds independently; it has no build-time dependency on the
Go repository or on private modules. The source is under the Apache License,
Version 2.0 ([LICENSE](LICENSE), [NOTICE](NOTICE)), as PlatformKit is.

## Run locally

Install Git, the Node.js version in `.nvmrc` and npm, then run these commands from
this repository. `npm ci` installs the exact versions in `package-lock.json`:

```sh
npm ci
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
platform toolchain. `npm run web` starts a browser preview, but the credential
is a native one: a sign-in mints a scoped bearer key (`POST /auth/tokens`) and
ordinary JSON and stored-file requests present `Authorization: Bearer` alone.
The scopes are not the list the sign-in answered with: the mint refuses the wildcard by name,
and the built-in administrator role grants nothing else
(`modules/auth/internal/seed.go`), so `src/core/scopes.ts` turns what the account
holds into the permissions the pinned document declares for this phone's own
surface, and leaves out every grant the installation's operator holds alone. The other
credential is the session the password leg or the challenge leg answers with. It
is held in memory for as long as the key it minted is held, never written to
storage, and sent at the doors that answer to the person rather than to a
key: the mint, who-this-is (`GET /auth/me`), the key's own revoke
(`POST /auth/tokens/{id}/revoke`), the sign-out that closes it, this phone's own device
rows, and a composed picture read from a declared source. The pinned document names
`httpx.SignedIn()` at each of those operations that it carries, and a credential that
carries its own scopes is refused at all of them (kit/httpx/authorize.go), so a phone
that kept only the key could neither ask who it is, nor stop the key it is throwing away,
nor take back the row that carries its address. No request ever presents both, because a
request carrying both is answered as anonymous
(kit/httpx/authenticate.go's ambiguousCredential). Browser cookie restrictions
make that preview unsuitable as proof that sign-in works on a device.

## Find the owner of a change

`app/_layout.tsx` supplies the server URL and renderer pack to `Shell`, wraps
the screens in the theme that follows the device's appearance, and configures
the native stack whose headers every screen uses.
`src/shell.tsx` owns session restoration, sign-in, the answer to a second
factor, sign-out, catalog loading and a count of what this app wrote to each
resource, so a list or a detail knows when what it shows is stale. It also owns
the expired-session boundary: the transport reports that a server answered 401,
and the shell alone decides that this session is over, what the person was doing
when it ended, and who that belongs to (`src/core/reentry.ts` holds the rule; no
screen is asked to notice).
The resource route files delegate to `src/route.tsx`, which finds the catalog
entry and chooses a custom or generated screen.

`src/core/` holds the catalog types and validator, screen derivation, the
pure value helpers (an instant, a number, what a form may refuse before the
server does) and the lifecycle reducer. These functions run in plain Node
without React.
`src/effects/api.ts` owns HTTP requests and API error decoding;
`src/effects/session.ts` orders secure-storage operations and binds the server
URL, the bearer key and that key's id in one versioned record; a record from the
format that held a session cookie loads as the server it names, so an upgrade
signs in again rather than failing. `src/effects/native-session.ts`
supplies Expo SecureStore. Each shell operation has a generation; the core
rejects obsolete responses after sign-out, another sign-in or a newer refresh.
An answer to a second factor is an operation of its own in that sense too: it
makes its own connection to the server that refused the password, so the key it
mints belongs to that answer alone, and an answer that lost the race — which the
kernel expects, since it spends the proof of the first factor once — gives back its
own key and never the one a newer answer earned.

`src/ui/` is the component library, in one direction of imports that ESLint
enforces (`eslint.config.mjs`): `atoms/` are single controls and words,
`molecules/` are rows and fields, `organisms/` are the generated list, detail,
form, home and sign-in as pure components of props, and `templates/` own the
scroll, the large-title inset, the safe area and the keyboard. Nothing in
`src/ui/` reaches for the shell, a transport or the router; effects arrive as
callbacks. `src/ui/theme.tsx` decides colours and faces from the device's
appearance; its palette, `src/ui/tokens.ts`, is generated by `npm run tokens`
from [testdata/design-tokens.json](testdata/design-tokens.json), a checked-in
projection of the public repository's design export whose origin
[testdata/design-tokens.source.json](testdata/design-tokens.source.json)
records: the upstream commit, the command that projected it and the fixture's
SHA-256. Both files are build inputs the native fingerprint hashes. Refresh
them deliberately, as [Verify a change](#verify-a-change) describes; the token
tests fail when the fixture, its provenance and the generated file disagree.
Distances live in `src/ui/scale.ts`. The gallery
(`src/ui/gallery.tsx`, served by `app/gallery.tsx` whenever the app is running in
development, or in a build made with `PK_PROFILE=ci`, the profile that sets
`extra.gallery` in `app.config.ts`) shows every atom and molecule in both modes.

The [shared mobile components specification](docs/shared-mobile-components.md)
defines the richer components, their APIs, reuse, gallery states and delivery
order. The shared families now have source implementations and literal Gallery
examples. Native acceptance and the complete product/theme matrix remain unverified.

Keep UI imports pointed toward the primitives. Atoms may compose other atoms;
molecules add atoms; templates supply layout through children or render callbacks
and may compose atoms and molecules. Organisms combine these layers. Shared
theme, scale and token helpers import no components, and components never import
the gallery. ESLint checks these boundaries along with the UI's effect boundary;
`tests/layers.test.ts` exercises permitted composition and rejected imports.

`src/screens/` is where an effect becomes a prop: one hook per generated
screen (`useResourceList`, `useResourceDetail`, `useResourceForm`) owns its
requests, its generation guard and its phase, and one composition per screen
sets the native header and renders the organism. A form is presented as a
sheet; Save exists only once the row has loaded; a dirty sheet asks before it
is dismissed. A select asks the platform's own chooser, an instant its own
date and time controls, and an instant reads in the device's zone, which is
the one place this shell deliberately reads differently from the web shell.

Only the current atomic session record is supported. Older installations require
a fresh server selection and sign-in. Failed saves
prevent sign-in completion. Sign-out immediately clears the active client;
if secure storage cannot be cleared, the sign-in screen reports the failure
and provides a retry. Until clearing succeeds, reopening the app may restore
the previous saved record.

A custom screen belongs in the renderer pack passed to `Shell` in
`app/_layout.tsx`. The [Renderers type](src/renderers.ts) maps `module/entity`
to optional `list`, `detail`, `form`, `command` and `deck` components. Each receives an
`entry` and, when applicable, an `id`; command screens also receive the `verb`.
Any omitted component falls back to the generated screen. A product's custom
screens belong in `src/screens/`, where effects become props for the atomic UI
layers. Add a custom screen when the workflow needs something the resource
schema cannot express, and read
[the pack contract](#a-modules-own-screen) first: it names what a screen may
read, how an entry asks for it, and which screens the schema already does well.

## HTTP contract

The HTTP contract is pinned in [testdata/openapi.json](testdata/openapi.json),
with its public commit and SHA-256 in
[testdata/openapi.source.json](testdata/openapi.source.json). This pin contains
130 paths and 163 operations, among them a read's `?lang`, a stored picture's
`?w`, the four translation members of a content record, and the `translatable`
and `keys` members of a catalogue field. `npm run api` generates the TypeScript
types, Zod validators, SDK and documented route table in `src/generated/`; `npm run
check:api` regenerates into a temporary directory and refuses changed, missing
or extra files. It runs offline as part of `npm run check`. Refresh the public
document and provenance deliberately before regenerating. Node 22.18 or newer
is required by the pinned generator.

The generator's `@hey-api/json-schema-ref-parser` dependency pins `js-yaml`
4.2.0. A scoped npm override uses the patched 4.3.2 release for that parser
to fix its YAML denial-of-service advisories. Remove the override when the
generator's dependency accepts a patched release; `check:api` must still
confirm identical generated output after any tooling update.

Documented requests use their generated operation's response validator. Core
owns supported catalog versions and field kinds, nullable-array normalization,
and the compatibility extension for version-2 `operations`. It retains generated
metadata without making web `screen` addresses into native routes. An unstamped
catalog retains public `version: 0` through `api.catalog()`; an explicit zero or
future version refuses. `api.operations.appResources()` uses the strict generated
wire schema and refuses an unstamped catalog with a path-named `ApiError`.
Generated schemas keep JSON numbers as numbers, without string coercion; this
does not establish lossless support for every int64 monetary value.

Custom renderers receive the generated methods on the current shell API's
`operations` property, already bound to its connection and validators, and a
screen's own accessor over them is `useOperation` above:

```ts
const result = await api.operations.taskTaskRead({ path: { id } });
const task = result.data;
```

Each method accepts its generated body, path, query and header inputs, plus an
optional `signal`. Its types do not accept a different URL, transport or validator.
These types are not a runtime security boundary for a caller that bypasses them.
Generated types are also exported from `@septagon-oss/platformkit-mobile/generated`.

There is no shared client instance or per-composition regeneration. The generated
client covers only the pinned document. Catalog entries outside that document
retain the generic record/page contract: rows must be objects, and pages require
`items` (an array or null) and integer `total`. Their domain fields are not
validated by a reference operation. Documented pages additionally require their
operation's row schema, integer `limit` and integer `offset`. A client's own
composition document and generated client remain downstream work.

For module-owned JSON and recovery routes outside the document, custom screens
use `api.request(method, path, validate, body?)` from the current shell API. `path` is an encoded path under
`/api/v1/`, with an optional query string; the selected server and session stay
with the shell. The method is explicit: GET, POST, PUT, PATCH or DELETE. An
omitted body sends no content. Supply a validator `(value: unknown) => T` from
`src/core/`, such as a hand-written guard or a Zod schema's `parse`. The result
is `Promise<T>`; the validator also receives `undefined` for an empty body and
must explicitly accept it. Invalid JSON and validator exceptions become
`ApiError` with the response status and request path, without copying response
values or validator messages. A 2xx status on `ApiError` means the server answered
but its success response was malformed. HTTP problems retain their existing decoding.
The request uses the same bearer key and deadline as resource operations; a
sign-in's session cookie belongs to the mint alone and never reaches here.

Pass `{ signal }` as the fifth argument to cancel a screen's obsolete request;
cancellation rejects with `AbortError`. A timeout remains an `ApiError` with
status 0. Neither transport nor cancellation proves that a write was rolled back, and the client
does not retry requests automatically. Recover uncertain writes through the
module's persisted read contract before offering another submission. Screen
generation guards still decide whether a response belongs to the current view.

### What the catalogue says about how it reads

An entry, a field and a command may each carry a `presentation` object: the
resource's own words for how it should read ("Tarefa", "Em aberto", which field
titles a row, which value is good, which command is the system's). The phone
parses them into `hints` on the entry, field and command — never raw wire bytes,
so `presentation` reaches no component — and every one of them is read in
`src/core/derive.ts`, where the resource's words are read today. For a resource
that declares nothing the default _is_ the previous rule, so honouring the whole
contract changes no screen until a server declares a hint.

A hint is never the reason a workspace is refused. The generated schema prints
`additionalProperties: false`, so one mistyped noun would cost every screen in
the app; the hint therefore enters the phone's own parser as `unknown`, and
`hintEntry`/`hintField`/`hintCommand` decide its shape, member by member. A
member of the wrong kind, a name outside a vocabulary this build can draw, or a
pointer at a field the entry does not have falls back to the documented default,
the rest of the same hint survives, and the defect names itself once through the
`HintNotice` the caller supplies — `Api.catalog(notice?)` passes one that logs
each distinct (path, reason) per connection. `parseCatalog` without a notice says
nothing, which is what keeps the nightly's use of it unchanged. The two
exceptions to per-member reading: an entry's `sections` is taken whole or not at
all, because a block with no key or label is no block — and a field that named one
of the blocks the entry lost is left in the overview, since a record cannot be
grouped under a heading nobody declared; and a field both `hidden` and `required`
stays in the form, because the person's only path to a submittable create is never
taken away for an author's slip.

A declared word is the author's and is used as written — never humanised,
re-cased or re-pluralised — so `copy.ts` holds one new string, `kit.untitled`, for
the record whose schema names nothing to read from.

A declared visibility is read on every screen it speaks about. `hidden` is the one
visibility no screen draws — off the list, off the record's own page and off the
form, its value left in the schema, the JSON and the PATCH where nothing a person
reads is built from it — and `detail` is a record's own answer, which a row has no
room for. A row asks one question of every field it could draw (`rowContent` in
`derive.ts`) and asks it of the field it leads with, the line under that name and
the cells beside it alike, so a field its author kept for the record neither titles
a row, is quoted under its name, nor reaches it as a column — however the entry's
hints point at it. Its columns and the field that leads them are chosen from one
list (`rowFields`), so they cannot disagree about the answer: an identity picked
from the whole schema would put the value back through the column every row leads
on, which is the web shell's rule for the same reason (`known(onList(…))` in
`ui/resource/resource.go`). A hint that points where its screen may not read —
`primaryField`, `previewField`, `summaryFields` or `statusField` naming a `hidden`
field, or one of the row's three naming a `detail` one — names nothing and lets the
default read on (a `detail` field stays the record's own name and the record's own
state, which is what `primaryField` and `statusField` answer there): the reference
kernel refuses that document at mount (`kit/rest/hints.go`, `namedFieldFault`), and
one author's slip is not worth this app's screens.

### How Home greets the person

Home is a greeting, a name and a few counts before it is a list. Top to bottom: the
accent wash with the greeting and the workspace under it, the account line, what this
phone is holding, up to three stat cards, the records this phone remembers opening, and
the resources as icon-tile rows — now with the installation's own count in the column a
scan reads down. Pulling refreshes the catalogue and the counts with one spinner. Three
cards are wider than any phone's column, so the card row wraps: two share the first line
and a third stands on the next one, every card drawn whole.

The greeting is the part of day in the reader's own zone (morning from 05:00, afternoon
from 12:00, evening from 17:00) and the person's first word — an address is never a name,
so `joao@acme.test` is greeted "Good morning" and nothing else. A card counts the total
when the body answered one and the highlight when it answered only that; its label is the
entry's declared plural or the declared `presentation.highlight.label`, and its secondary
line is drawn only when both numbers arrived _and_ the catalogue named the second one.
The counts body carries integers and dates and no word, so the phone writes none: an
absent number stays absent — no card, no row count, and never a `0` nobody answered. The
body is the workspace's _now_, so Home asks it on opening, on a pull, and on coming back
after this app wrote to a resource those counts count: a number that outlived a record
this phone created is a claim about a moment that has passed.

A remembered open is one row of `recent_open`: the resource, the record, the words the
record screen drew for it and the instant it was opened, keyed by server and sign-in so a
new person at the same phone reads an empty section without anybody deleting anything. A
record is remembered while its row is on screen, reopening replaces its row rather than
adding a second one, twenty are kept and five are shown, and the pruning happens in the
same transaction as the insert. Nothing is sent: the section says what this device opened.
A build that ships no table for them draws no section, and a read that cannot be stored changes nothing
on the record screen. A record this phone deleted leaves the list with it — the delete
that reached the server withdraws its door, because a section that kept it would lead to a
row that answers not-found — while a delete the outbox still holds keeps its door until it
has gone. A withdrawal this phone's own table refused is the device's problem and not the
delete's: that one row stays, and the record screen still says the delete happened, which
is what the server answered.

**Limits** — a card opens its resource's list, not that list narrowed to what the card
counted: `filter=field:value` is an equality on a closed value set and a highlight is a
predicate range whose anchors the server resolves per request, so the kernel has to echo
the address, or name the spelling that opens what the card counted, before this kit can.
The number is drawn still, not rolled in — the motion is T-0334's, and no screen may
import `react-native-reanimated`. Which three counts a workspace means is the body's own
order, because the catalogue carries no order to read. `firstName("Dr. Ana")` is `"Dr"`:
the rule takes the first word, and nothing names which words are honorifics. The section
is this device's own — an open is not carried to another phone, and it is not cleared at
sign-out, which is why a new person at the same phone reads an empty one.

**Reused** — `ListScreen`'s `header` slot and its one `RefreshControl`, `Section` (with
its caption naming the resources group, through `ListScreen`'s new `groupTitle`, rather
than a heading the page drew beside it), `Row`
(with its `trailing` column), `RowMedia`/`homeMedia`, `Avatar`, `Text`; `StatTile` and
`Sparkline`, the two molecules nothing but the kit gallery drew until now; `deriveStat`
and `deriveSparkline` (`src/core/charts.ts`) for every number and every shape; `noun`,
`accountPerson`, `hostLabel`, `key`; `useOperation` for the read and the `reload`/`refreshing`
pair the screen already had; `react-native-svg`'s `LinearGradient`, the overlay
`RecordCover` already draws, rather than a new gradient dependency; `useFeedback`'s
`now`/`timeZone`; `tests/fakes/shell.ts`'s `answering`-style transport in the pin test.
**Added** — `src/core/summary.ts` (`statCards`, `rowCounts`, `StatCardModel`), because the
join between the counts body and the catalogue existed nowhere and a component joining them
would be a second implementation; `EntryHints.highlight`, because the kernel puts a
sub-count's words in the catalogue (`kit/entity/hints.go`) and this parser read no
`highlight`, so the label vanished silently; `greeting`, `firstName` and `workspaceName`
beside `accountPerson`/`hostLabel`, which own the name and the address they read; `civilHour`
in `presentation.ts`, where `civilParts` already reads parts rather than strings; `StatCard`,
because `StatTile` is a panel and a card is a panel plus a shape plus one sentence; the
two `Sparkline` props (`height`, `decorative`) and `StatTile`'s `framed`, each read by
`StatCard` and by nobody else; `surface.band` and its two contrast pairs, the tint measured
to 0.07 rather than picked; three `extent` members; eight words in both languages; and the
pin's counts door (`build(api)`, first commit), which `documented()` refused until it moved;
`src/core/recents.ts` and `src/effects/recents.ts` (`Recent`, `RecentRef`, `RecentDoor`,
`recentHref`, `RECENT_SHOWN`, `RECENT_KEEP`, `createRecents` and its `forgot`) over a
`recent_open` table, exported as the `./core/recents` and `./effects/recents` subpaths
beside the `read-cache` ones they are modelled on — same `(server, person)` scope, same
bound-pruned-in-the-write, same parse-on-read that drops a row it cannot read rather than
refusing its table, because a cache may be lost and a held write may not. `ListScreen`
gains the optional `groupTitle`/`groupTestID`, which are the grouped `Section`'s own
caption and address.
**Made reusable** — `ShellValue.recents`, so a product's own "continue where you left off"
reads the same handle rather than a second table; `src/core/summary.ts` as the one reading of `GET /api/v1/app/summary`
for any surface that shows counts (a client's own dashboard, a widget, the web twin's
columns); `StatCard` and `StatTile`'s `framed`/`Sparkline`'s `height`+`decorative` as kit
molecules any client composes; `greeting`/`firstName`/`workspaceName`/`civilHour` as the
name-and-hour rules any first screen reads; `EntryHints.highlight` as the parse a declared
sub-count needs; `surface.band` as the registry's first painted page; and the ids
`home-greeting`, `home-workspace`, `home-stat-${module}-${entity}` and
`home-count-${module}-${entity}` for a journey to find.

### How a list row reads

A row answers four questions and no fifth: **which record is this**, **what state is it
in**, **what does the record say about itself**, and **what sets it apart from its
neighbours**. `listRow` in `src/core/derive.ts` assembles the answers from the four rules
that already owned them — the field a row is called by (`rowPrimary`), the state the entry
declares (`statusField` with its `enumLabels` and `enumTones`, read through the one
`statusPill` a record reads too), the line under the name (`listPreview(entry, "row")`) and
the couple of values beside it (`listCells`, budgeted at two whoever named the fields) —
and nothing else. The state
is one of those four answers and not two: the value `statusField` names is the row's pill,
in the column `Row` reserves for it, and is never one of the two cells beside the title,
even where an author points `summaryFields` at it — a fact is drawn once, at the place that
owes it, which is the rule that keeps a record's header out of its own rows. A row is never
titled by an identifier and never filled with one: the stamps and the id are plumbing, are
not cells whoever pointed at them, and the record spells them out in its own "Record
information" block for the person who needs them. Two cells is the budget in both of the
branches that choose them: a declared `summaryFields` longer than the line keeps its first
two, in its author's order, because the row owns the slots and a phone has no room for a
third whoever asked for one. `hideList` is asked the question
it answers — which columns a list has — so the paragraph every schema marks
`hideList` lines a record, which has room for it, and not a row, which does not; a row
with nothing worth reading under its name shows nothing there, never a dash. A value that
was never answered prints no cell, and a pill is never drawn for a state the document did
not declare, so an un-hinted resource shows a title, its line, and its values.

How the list is being read is two questions, and the kit asks them separately. **In what
order** is the sort sheet: newest, oldest, then one row per direction for each field the
entry may be ordered by (`sortable`, else the field a row is called by and the date fields
it declares), worded for that field's type — "Due at, soonest first", "Rank, low to high",
"Title, A–Z" — in the reader's language. Nothing without an honest direction word, and
nothing that is plumbing, is offered. **Narrowed how** is the filters sheet: one group per
filterable field, each leading with "All" so the group always answers, and one action that
empties them all, present only where it has something to empty. Clearing filters keeps the
sort, because ordering is not narrowing — which is the same fact that makes
`sorted-but-unfiltered` answer "No notes yet" and never "No matching notes", and why the
count on the toolbar says "Filters · 2" for two filters and no order. The two controls sit
in a toolbar row under the header, where the list is; that row is named for itself ("List
controls") and not for one of the two doors it holds, so a reader hears a group and then its
two doors, and a choice in the filters sheet carries the name of the group it narrows.
Neither control is offered on a list that holds nothing and has nothing filtered.

**Reused** — `rowPrimary`, `label(…, "row")`, `statusField`, `enumLabel`, `enumTone`,
`badgeTone`, `listColumns`, `listCells`, `listPreview`, `saidValue`, `display`, `hasValue`,
`filterFields`, `queryFilters`, `noOrder` and `nounPhrase` in the core; `DataRow.status`,
`DataCell`, `Filter`, `Sort`, `deriveChoices`, `deriveActions` and `deriveDataList` in the
list family, whose `targets` are the orders both sheets offer; `deriveSurface` and
`DetailSheet` for the sheets, `ActionBar` for the toolbar, and `Value`, `Labelled`,
`Badge`, `Notice`, `Row` — with `Row`'s `shown`, `trailing` and `selected` props, all three
of which were declared, documented and passed by nobody until this delivery. **Added** —
`listRow`, because the row was an object literal inside the list adapter and no function
answered "this record as a line"; `statusPill`, which is `recordHeader`'s pill extracted,
since a record and a row colouring one value differently is one rule written twice;
`sortFields`, `deriveSortSheet`, `deriveFilterSheet` and `deriveListToolbar`, because the
brief's toolbar is a control with a count and a visibility rule that belongs to neither
sheet; and `ChoiceRows`, because the inventory held `ChoiceChips` (a wrapping wall — the
thing being replaced) and `SlotOption` (the same idea welded to a capacity model), and no
sheet-sized group of rows: it is `Row` in a radiogroup and nothing else. **Made
reusable** — `statusPill` is now the only reading of a declared state, so any surface that
wants a pill asks it rather than restating it; `listPreview(entry, where)` is the medium-
aware rule every future screen reads; `filtered`/`reordered`/`activeFilters` are three
questions any screen can ask without the old word conflating them; the sortable hint, the
two ids `sort-sheet`/`filter-sheet` and the `list-toolbar` id are what a journey and a
renderer pack reach for; and `kitCopy` gained the direction words, the three empty answers
and "All"/"Clear filters" in `en` and `pt`, so the next screen that orders or narrows a
list writes no sentence of its own.

A row can also be acted on from where it stands. When the entry declares
`hints.primaryCommand`, its row is dragged from the trailing edge, the command the verb names is
uncovered under it, and **the release is the moment of decision**: at or past the width of what
the person uncovered, the phone runs it — and a drag the system or a second finger took back away
from the row is not a release and runs nothing. What the surface is worth is the width it stands
open at, so a command that will run and a row that looks ready are one sight, read by one function
(`readSwipe`) that the reanimated surface, the component fake and the threshold's own suite all
consult — a function marked `"worklet"`, because a drag is read on the UI runtime, where a plain
shared function arrives as one that may not be called from the finger at all, and where the two
things the crossing asks the phone to do — the tick and the run — are therefore asked for from
inside the worklet (`scheduleOnRN`) rather than through a function prepared beside it. What hurts, or what
the author declared a consequence for, is asked about first, in the
same question the record asks; the verb resolves through the same lookup a typed address uses, so
the two doors cannot disagree about which command a name means; and nothing is swipe-only — `Row`
still offers the same command as a named action a reader can speak. A list whose app supplies no
surface draws its rows exactly as it did. A write that opened no page leaves its receipt at the
foot of wherever the person is standing (`Snackbar` over the navigator, filed by the shell), for
as long as it takes to read once — and only for that person: a write that answers after its own
session signed out files no receipt, no sentence and no moment for whoever signs in next.

**Reused** — `commandOf`, `commandAt`, `offered` and `commandWording` for which verb a row runs and
in whose words, `entryIcon` for the picture it wears, `Row`'s existing action title for the door
with no finger in it, `outbox.submit` and its existing idempotency key for the run, and
`deriveState`/`StateView`/`Notice` for every word and colour the receipt draws. **Added** —
`rowAction` and `rowSwipeTone` in the core, and `readSwipe` in the new `core/gesture` subpath,
because the inventory found no threshold of any presence in this repository; `Snackbar`, because
the register's `R40` records that nothing here was ever timed or elevated; `report`, `reporting`
and `spent` on the shell, a third channel of the shape it already kept twice over; and
`RowSwipe` behind the renderer pack — the drag is react-native-gesture-handler, and importing it
evaluates react-native-worklets, which throws wherever no native runtime is loaded, which is the
same reason `src/renderers.ts` exists. **Made reusable** — `useCommandSend`, the submit that lived
inside `useCommandAsk`, is now the one submit the sheet and the row share; `readSwipe` is the one
reading any future surface is measured against; and the composition root draws its screens inside
one `GestureHandlerRootView`, which is where every gesture this app recognises is recognised.

### Review a declared queue

A resource with a valid `presentation.deck` shows **Review n** in its list toolbar.
The count is a live read of the declared queue and order, independent of the list's
current filters. An empty queue or a declaration with no authorized directions
leaves the control disabled. The generated deck route is the resource's native
screen path followed by `/review`; a renderer pack can override `Renderer.deck`,
and `MediaRenderers.deck` supplies the optional native gesture surface once.

Before enabling choices the phone captures a finite, first-seen roster through
sequential list windows bounded by the first total. Its commands cannot shift a
later page because capture finishes first. This is an observation of offset pages,
not an atomic snapshot: concurrent changes can still omit rows. A final live read
must answer zero before the phone says **All caught up**. A pass containing skips
can instead finish as **Review complete**, with how many were left for later.

The top card offers every declared direction as a visible button and a named
accessibility action. Horizontal drags arm at one third of the measured card's
width, vertical drags at one quarter of its height; equal normalized travel picks
the horizontal axis. The label and tone follow that direction, tilt stops at twelve
degrees, and one haptic tick marks a crossing. Short or cancelled drags return to
rest. Reduced motion removes translation and tilt and cross-fades completed choices.
The two rear cards and all controls have the same still meaning without motion.

A local down skip defers a card for this pass and makes no request. Rewind restores
only the latest skip, provided no later irreversible command stands in its way.
The pinned server has no undo declaration, token or operation, so command rewind is
unavailable. Declared destructive/consequence confirmations remain mandatory;
defaulted command arguments are left to the server by sending no body. Refusal
restores the card with safe localized words. Held or unknown writes lock it without
progress or a second submission; the existing held-write surface owns resolution.

**Reused** — catalog validation, `Api.list`, shared command/outbox submission, core
row/value/picture derivation, `ProgressMeter`, native stack routes, the renderer
pack, `useFeedback`, theme/scale and the finishing renderer carry Review.
**Added** — a bounded pure deck reducer, four-direction geometry and a deck
hook/organism/native surface, because the existing row swipe owns one trailing
command and no queue history.
**Made reusable** — any authorized resource can declare the same queue presentation;
products keep their fields, predicates and command semantics and can supply a deck
screen or motion renderer through the existing pack.

The [state and threshold specification](docs/review-deck.md) defines the contract
and independent examples. Node cases cover that reducer, geometry and Worklets
serialization; component cases cover still cards, accessible choices, shared
submission and refusal/uncertainty. The native `e2e/flows/deck.yaml` creates a draft,
defers a card and rewinds it. These local suites and web still fixtures establish
neither a device journey nor live-server authorization, concurrency or RLS. Native
animation, gestures, haptics and screen-reader focus still require an emulator run.

### How a record opens

One rule decides the whole of a record's hierarchy: **a fact is drawn once, at the
highest place that draws it.** The places, in order, are the title, the status pill,
the one summary line, the overview blocks and the collapsed "Record information". A
field that a higher place drew is not a row anywhere below it — which is why the
record is not called by its own name twice and why the field the entry points at with
`statusField` is not repeated under the pill it just filled.

Three total functions in `src/core/derive.ts` answer that, each a pure function of the
entry, the row and the reader: `recordHeader` (the primary field's value, the declared
`statusField`'s pill with the declared `enumTones` colour, `listPreview`'s one line —
never a pill inferred from "the first enum", never a dash for a line nobody filled
in), `recordSections` (the fields with values, grouped by the entry's declared
`sections` in declared order, each block in schema order, fields naming no block in a
final "Overview", an empty block left out) and `recordInformation` (the identifier,
the two stamps, then every field the document keeps for this screen that no higher
place drew — in that order, collapsed and last, its identifier selectable and
monospaced). `hasValue` is the one emptiness test, and it is the reading side of the
line `values` draws when it builds a PATCH: `false` and `0` are facts and keep their
row, while nothing, an untouched blank, an empty list and a switch nobody answered do
not. `hidden` beats every declaration here: its value and its label reach no sentence
on any screen. A record with nothing to say answers no blocks at all — no placeholder
sentence, because 0085 defers an "Add {field}" affordance until it has an interaction
contract.

Delete lives in the header's `…` — drawn only where the resource mounts DELETE and the
caller may use it, opened inline as the first row under that header and above every
row of the record, and asked in 0085's words ("Delete '{title}'?" / "You can't undo
this in the app." / "Cancel", "Delete {singular}"). A command the catalogue marks
`system` is never offered at all, and a command's row carries its own title with no
developer prose under it. The trail names people — "You", a name, the system, or "Name
unavailable" — and never a user id; where the plan excludes it the section is not
drawn.

**Reused** — the hint surface T-0328 landed (`EntryHints.sections`,
`FieldHints.section`/`visibility`/`enumLabels`/`enumTones`, `CommandHints.system`) read
through `label`, `primary`, `statusField`, `enumLabel`, `enumTone`, `badgeTone`,
`listPreview`, `fieldLabel`, `saidValue`, `display`, `neverShown`, `commandTitle` and
`offered`; `DetailItem`, `DetailRow` and `Value` for every row; `Section`, `Row`,
`Badge`, `Screen`, `Notice` and `Skeleton` for the drawing; `SummaryDetail` →
`DisclosureSection` → `deriveDisclosure` for the collapsed section; `doors`/`offers`
for the delete door and `confirm` in `src/ui/chooser.ts` for the question; `nounPhrase`
for the noun in a sentence and `kitCopy` for every word. **Added** —
`recordHeader`, `recordSections`, `recordInformation` and `hasValue` in the core, plus
`informationFields`, because the inventory held no function answering "this record's
fields that have values, grouped": `detailItems` was the only reading of one record and
it returned one flat list, which is what made a screen open on its own identifier; the
two hint half-pairs (`statusField`, `enumTone`/`badgeTone`) were parsed and read
nowhere until this delivery drew them. **Made reusable** — the three functions are the
record's hierarchy as data, so a client's renderer pack can take the header block, the
blocks or the plumbing apart without redrawing the screen; `hasValue` is the emptiness
rule for any screen that reads a row; `Value` now paints a closed set with the tone the
document declared for that value, which is the pill a list row wants next; and
`record-menu`/`record-information` are the two ids a journey finds a record's header
menu and its collapsed block by.

#### A record opens on its picture

A record whose entry declares `coverField`, and whose row holds a file identifier in it,
opens full-bleed on that picture: `extent.cover` tall, under a transparent native header
that keeps only Edit and `record-menu`. The record's own three facts — its name, its pill,
its one summary line — are drawn by the page over the photo's foot rather than by the
header, and the gradient under them ends in the page's own ink (`surfaceCanvas`), so the
title is measured on the pair `contrastPairs` already answers for and the first section
below starts where the photo ends. Scrolled past `extent.cover - extent.headerBar`, a band
pinned under the native bar names the record; it is a cut in both motion modes, because a
band that fades in over a scroll-driven transform re-renders vibrancy every frame. A record
with no cover field, with one its row leaves empty, or whose pictures this phone cannot read
at all — no picture door in the catalogue, or no session ready to read one with — draws the
header block it always drew and keeps its native title: the same `recordHeader`, two drawings,
chosen by whether a cover can be drawn, which is the same answer the organism is given in
`files`.

A field declared `present: "images"` is a gallery: a horizontal strip of `extent.strip`
tiles in the block the document filed its field in, after that block's facts, each tile
opening the kit's `PhotoViewer` at that picture (a fixed list — `more: false`, so no "Load
more" — paged by file identifier, never by position). Both surfaces take the field out of
the rows below through `headerDrawn`, valued or not: a file identifier printed as a fact
about the record is the same fault as printing it twice. `visiblePictures` asks for exactly
these ids when the record is drawn, always, and never for what the Record information
disclosure still holds back. A file the server carried no frame for is drawn in the frame
the slot declared and cropped to it; a file nobody captioned is drawn and never offered for
opening, because this phone holds no words for it and inventing none is the point.

**Reused** — `recordHeader` for the three facts the cover draws, and `headerDrawn`,
`shownFields` and `informationHeld` for who draws a field (the exclusion is the existing
answer, grown by the cover and the galleries, not a second rule); `picturePointer`'s
validation of `coverField` at parse time; `pictureId` and `compactPicture`'s
`(file id, instance)` identity; `visiblePictures` as the one selector `usePictures` is fed;
`MediaHero`'s `ImageRenderer` slot, `Badge`, `Text`, `Notice`, `Skeleton`, `radius.lg`,
`space.*`, `type.title` and `theme.tsx`'s roles (no new colour, no hex); `react-native-svg`,
already drawn on by `Sparkline` and `AreaChart`, for the one overlay; `kitCopy`'s `images`,
`open`, `imageUnavailable` and loading line; `PhotoViewer` reused as the full-screen surface,
grown only by the two props named below, with `deriveViewer` and `deriveMedia` untouched and
`pageControl`'s answer to a page with no more unchanged. **Added** — in the core, `coverPicture`, `galleryFields`, `headerCover`,
`recordCover`, `recordMedia`, `recordPictureIds` and `RecordBlock.strips`, because the
inventory held the record's three places and the row media but no answer to "which files
does this record draw, and in which block"; in `pictures.ts`, `fileMeta`, `filePicture` and
`pictureState`, because nothing exposed a `file` row's `width`, `height`, `alt` or
`decorative` past the picture door; `PhotoStrip` (no horizontal list existed in the kit:
`grep -rn "horizontal=" src/ui` is empty, and `PhotoGallery`/`MasonryWall` are paged
collections a resource answers) and `RecordCover` (`MediaHero` writes its caption _below_
the frame and an Open button under that, where the record must put its name _on_ the photo
and offer no open affordance of its own); `kit.photoCount` in both languages; `extent.cover`,
`strip`, `coverFoot` and `headerBar`; `Screen`'s optional `onOffset`, the handle a cover
needs and no rule of its own; `usePictures`'s third argument (how wide a slot draws) and its
`files` answer; `PhotoViewer`'s optional `renderZoom` and its
`animationType="fade"`, so a picture may open without the gesture surface a product has not
chosen and its modal opens with a cross-fade. `expo-linear-gradient` and `expo-blur` were
refused: either changes `fingerprint.json` and therefore the binary, and `svg` already
draws the one overlay this page needs. **Made reusable** — `recordSections`'s optional
`media` argument, which is how any block answers the galleries filed in it without a second
block-order rule in a component; `filePicture`, the file-row→picture step for any surface
that draws a file by identifier; `usePictures(ids, attempt, width)` answering pixels per
caller; `PhotoStrip` and `RecordCover` as the two surfaces a client's renderer pack can mount
on its own record screen; and `record-cover`, `record-title`, `photo-strip`, `photo-<n>` and
`record-title-bar` as the ids a journey finds them by; and `MediaRenderers` in
`src/renderers.ts` — the pinch surface a picture opens into and the cover's motion, named once
on `<Shell>` by the composition root — with `src/screens/CoverMotion.tsx` as the one file in
the app that names `react-native-reanimated`, and this app supplying it and `NativeZoom` in
`app/_layout.tsx`. Those two had to arrive as props rather than imports for a fact about the
environment: importing reanimated evaluates `react-native-worklets`, which throws where no
native runtime is loaded, and zoom-toolkit imports reanimated in 45 of its files, while every
screen is loaded by the suite that checks it. A product that supplies neither gets the still
record — the photo holds still, the picture opens at the page's own size, and the buttons page
between them — which is a complete record, not a broken one. `extent.coverParallax`,
`coverShrink` and `coverFoot` are the numbers a device will judge, owned by `src/ui/scale.ts`
and by no component.

#### A record opens where the press was

A list row that draws a picture, pressed, files the frame that picture stood in — `measureInWindow`
at the moment of the press, for the address the row opens — and the record it opens into grows its
cover from that frame instead of waiting at the top of the stack. One press opens one record however
the platform answers that question: a surface that answers as it is asked opens from its answer,
which is the only way the frame can be filed before the record mounts to read it, and a surface that
answers late or not at all opens from the press itself and simply draws no flight. What travels is a
frame and an address — `travelTo`/`travelled`, read once, the same one-shot lifetime the sentence a
write says already has — so no row, no value and no other record's state can arrive in this one, and a
row this phone never measured opens the ordinary native push it always opened.

#### A record finishes on the write that finished it

A state crossing into one the entry calls _finished_ is the one moment on this phone that a person
may not have seen coming, and it is worth saying so out loud. Which values mean finished is the
author's fact and nobody else's: `presentation.doneValues` on the field the entry names as its
`statusField` (`kit/entity/hints.go`), read by `finishedValues` and asked by `isFinished` — never a
tone, never the word a pill happens to wear, because `enumTones` says what finished _looks like_ and
the two tables are the kernel's own orthogonal pair. A document that declares nothing finishes
nothing, a value the field's enum does not hold is refused by name at parse time, and one bad entry
costs the celebration and never the field beside it. The entry's declaration is what makes a value
celebrable: the hint served on a field no entry reads as its state parses, and answers `[]`.

Two halves decide whether the moment plays, and neither one alone is enough. **The filing** says this
phone wrote to this record: a write that the server accepted files the record's address with the
shell, beside the one sentence a write already leaves there. A refused write, a write this phone is
still holding, a command over a whole collection and a create all file nothing. **The crossing**
says the state actually moved: the record screen keeps the row it last drew, and its next live read
can compare against it — a row that arrived already finished crossed under nobody's hand and says
nothing, and a row that an answer merely read back out of this phone's own cache proves nothing.
An answer this phone stored, a read that came from nobody's write, and a record that already had its
moment are all answered with silence. The line it says is made of the two words that are not this
kit's — the entry's own noun and the author's own word for the state — composed in `finishedWord`,
and iOS, which has no live region to say it with, is asked to announce the same sentence once.

The record's one moment per session is spent by the moment _playing_, never by a write filing it:
most writes to a record finish nothing — an acknowledgement, a title correction — and a person who
then resolves it is owed the sentence the earlier write would otherwise have taken. See
[docs/the-finishing-moment-needs-a-filing-and-a-crossing.md](docs/the-finishing-moment-needs-a-filing-and-a-crossing.md).
A person who asked for less motion, and a product that shipped no burst renderer, are given the
sentence with no ink drawn over the record, which is a complete moment rather than a broken one.

**Reused** — `statusField` and `statusPill` for the field and its word (`finishedValues` and
`isFinished` are their siblings, not a second owner of either), `ShellValue`'s one-shot
`say`/`heard` slot for the shape and lifetime of the filing and the journey's frame, `noun` and the
author's `enumLabels` for the sentence, `Badge` and `statusPair` for the state's colour, `MediaRenderers`
for the seam `zoom` and `coverMotion` already proved, `RecordCover`'s `CoverMotionProps` for the frame a
flight is drawn between, `Feedback.motion` for the preference and `extent` for every distance. **Added**
— `RolledValue`, because no atom in the kit owned "the same value, changed": it draws a string somebody
else derived, rolls only between two strings that share their columns, and never reads a rendered value
back into a number. **Made reusable** — `Badge`'s `motion` (a pill that changed while the person was
reading it changes in place, and asks nothing of a caller that has no preference to hand it),
`MediaRenderers.finishing`, and `ResourceDetail`'s `finishing` prop, absent meaning the record reached
nothing; `travelTo`/`travelled` on the shell, which carry one frame under one address and never a row;
and `record-finished` as the id a journey and a screen reader both find the sentence by.

#### A record can be kept

A person keeps a copy of a record so the copy outlives the record. The server owns that copy and
this phone holds no table of it: `probe` asks whether one is kept, `keep` asks for one, and
`remove` takes one away (`src/core/saved.ts` over `src/effects/saved.ts`). Nothing about the copy
is device-local, because a copy is the same person's on the web, and a phone with its own list
would answer differently for the same account.

Two declarations decide whether the heart exists, and both have to hold. A **source entry**
declares `presentation.saved` — the word to keep a copy with, the word for a copy kept, the word
that names the copy taken away, and `listEntry`, the "module/entity" of the entry that holds this
person's copies of it. The kernel's fifth word, `listTitle`, names a page a composition owns; this
kit names that page from the entry's own `presentation.plural`, so it neither reads the word nor
gates the control on it. A **saved entry** declares `presentation.availabilityField`, the one field
whose value says whether the source of a copy is still there. Every member that is missing, blank
or not a word names itself through the `HintNotice` the catalogue read was given, and
`savable` — which is the only reader of the declaration, and resolves `listEntry` against the
mounted catalogue — says itself through `Api.notice`. A heart that went missing with no line to
follow is a defect no author can find.

Neither write is ever offered as a form, a question or a swipe, because the two arguments they
take (`source`, `expectedRevision`) are what the screen already holds; `rowCommands` and
`collectionCommands` withhold them by the argument each carries, never by a resource key, and
`commandOf` still resolves both. The heart is the one door onto the act, and it lies about nobody:
`unknown` — nobody has answered yet — draws no control at all, the pressed state follows the
server's answer, a refusal leaves the control where it was and says why under it, and a save the
network never took says the phone is holding it in the queue's own words. A removal quotes the
revision its row arrived with, and is never queued: an offline phone cannot take a copy away, and
writes nothing while it pretends to.

A copy of a record that has gone stays in the list, still opens, and says which kind of gone it
is. `presentation.availabilityField` is read by `listRow`, so the generated list of the saved entry
draws that row in the theme's muted ink with the kit's sentence under its name: "No longer
available." and "Temporarily unavailable." are two answers — one says the record is gone, the other
that the provider is down — and a copy whose source is there says nothing about availability and
keeps the line its own entry writes.

**Reused** — `createOutbox.submit` and its `sent: false` answer for a save the network never took,
`commandPath` for both write addresses, `useResourceList`/`ListScreen`/`Row` for the window of
copies, `refusalOf` and `screenCopy` for every refusal sentence, `copy.state.holding` for the held
save, `Button`/`Icon`/`Text`/`Section`/`testable`/`chosenState`/`useTheme`, the catalogue's own
`hintWord`/`pointer` readers, and `heldScope`, untouched. **Added** — `src/core/saved.ts`
(`AVAILABILITY`, `savedAvailability`, `savedRef`, `saveBody`, `unsaveBody`, `sourceRef`,
`expectedSourceVersion`, `isKeeping`, `savable`, `savedCopy`), because the three availability
spellings and the two bodies existed nowhere in the phone and a screen inventing either would be a
claim about a server it has not met; `src/effects/saved.ts` (`SavedPort`, `SavedFinder`,
`SavedDeps`, `createSaved`, `KeptAnswer`), because every other port either holds a device-local
table or a queued write, and neither can answer whether this person keeps this record;
`src/screens/useSaveToggle.ts`, `src/ui/molecules/SaveButton.tsx`, `presentation.saved` and
`presentation.availabilityField` on an entry's hints, `Row`'s `muted` tone (greyed, pressable,
still offering its action), `Icon`'s `heart`/`heartFilled`, two sentences in both languages, and
`Api.notice`, the transport's own once-per-defect line, which a declaration resolved later than the
read now shares. **Made reusable** — `SavedFinder` as the one composition seam, so either shape the
kernel may publish (a find read of its own, or the answer carried on the source's own read) lands
in one adapter body and touches no component; `Shell`'s optional `saved` prop, which is that one
line at the app root; `Api.notice`; and the ids `saved-heart` and `saved-heart-pressed`.

**Limits** — the kit draws no list of copies of its own: the declaration's `listEntry` is an
ordinary catalogue entry and the generated list screen is the person's list, so `listTitle` is the
product's word for a door no composition in this repository mounts. No server in this build answers
any of it: no pinned document declares a savable entry, so every case runs over a catalogue a test
mounted, and the journey that presses the heart needs a server that mounts the two commands first.

### How a form asks

Three questions decide what a sheet holds, and all three are answered in
`src/core/derive.ts` rather than by the screen that draws them. **The set** is
`formControls`' answer: every field the entry keeps for the form, minus the ones it
hides — a `hidden` field is neither offered nor sent, so `source` and `source_ref`
never reach a label, a control or a request body. The one exception is a field that is
hidden _and_ required: the person's only path to a submittable create is never taken
away, so it stays in the sheet marked required, and the parser names that pair once in
the developer's channel. **The grouping** is the entry's own `sections`, in declared
order, with the fields that named no block landing in a last block carrying the word the
caller was handed (`copy.kit.overview`, "Visão geral" on a Portuguese phone); an entry
that declares no blocks gets one block with no heading, because the sheet is the group.
**The order inside a block** is `orderControls`: the field the record is called by
first, then required, then optional, and schema order within each of those. Schema
order alone put a required `pinned` below an optional `body`; the identity field leads
even when it is optional, and never leaves the block its entry filed it in.
`formSections` answers all three at once as blocks, and `commandSections` answers a
command's argument the same way with no identity to lead on. Neither moves a byte
`values` sends: reordering what is drawn does not reorder what is written.

A form the server resolved as steps is walked rather than scrolled. `steppedForm`
(`src/core/form/steps.ts`) answers the step list the block states for the sheet's own mode
(`layout.forms.createForm` for a create, `updateForm` for an edit) and nothing for a form
laid out flat; `stepBlocks` gives each step the controls naming one of its fields and drops
a step the sheet would draw empty, so a walk left with no block is the flat sheet above.
The screen holds where the person stands and asks the core's `stepTransition` for every
move — forward, back, skipped, jumped to — so the order a form may be taken through is
answered once in the core and never in a component; `stepProblems` is what Next refuses on
that step alone, `stepVerb` the word that button wears, and `stepOwning` the step a refusal
returns the person to. The words are the server's too: a step's `label`, `primaryLabel` and
`emptyLabel`, and the sheet adds none of its own. The last step's own verb is the write's
door, so a walked sheet names no header `Save` and keeps the header `Cancel`, and a sheet
the stepper cannot model is not walked at all and keeps the `Save` it always had. Nothing
below the walk changed: the body, the write, the outbox note and the arrival are still built
from the whole sheet read flat, so a stepped form writes the fields it never showed exactly
as the flat one does.

Help is the author's line. A field's `hints.help` is drawn under the field and
announced with it; the developer's `doc`, which describes a wire member, is
never drawn or announced on any form, sheet title or command screen — the same text
that used to put "Lifecycle state" in front of a person is now a note only a developer
sees, and no list carries a help sentence anybody did not write. Two sentences are the
kit's own rather than an author's, and they are the sheet's to draw, not the
derivation's: `changedByCommand` under a value only a command of its own changes, and
`identifierOnly` under a reference box that takes an identifier because no picker
exists yet. `control` hands back `hints.help` and nothing else, because a sentence
written there could only ever be in one language; these two sit in `src/core/kitCopy.ts`
with every other word a screen says.

One name is drawn above every control, by `FormField`, whatever the control is: a
switch, a chooser, a date row and a tag box print no name of their own and announce the
one the sheet gave them, so a control is named once and the columns line up. That
announced name carries whether a person may leave the field empty, in the reader's own
words ("Title, Required", "Pinned, Optional"), because `*` is not a word and a switch
that says only "Pinned" says nothing about leaving it alone. `field-<name>` is the id a
journey looks a control up by. The tag box announces it too — its input carries the
name the sheet derived, so a person hearing the sheet hears "Tags, Required" and not
only "Add to Tags", whose act the Add button names.

A list field stores its items comma-joined, so one item can never hold the separator.
`joinList` is the one spelling, `entryHoldsSeparator` is the box's rule and
`valueHoldsSeparator` the save's: `TagsField` commits a word on Return or on Add,
ignores a word already on the sheet, and refuses an entry holding a comma without
writing it, keeping what the person typed and saying which word it refused; the core
refuses a held value that does not spell its own items, so a list that arrived with a
loose comma is refused before anything is sent and never reaches the server half-spelled.
`tags-<label>`, `add-<label>` and `tags-fault-<label>` are the ids those three acts
work through. Every word the box says, in English and Portuguese, comes from
`src/core/kitCopy.ts`.

**Reused** — `neverShown` and the hint surface T-0328 landed (`visibility`, `help`,
`section`, `sections`, `singular`, `primaryField`) for what a sheet may offer and what
it may say; `primary` and the `namedBy` chain behind it for the identity field that
leads; `control`, `label`, `splitList`, `text`, `timeWire`, `numberValue` and
`listValues` for each field's own shape; `values` and `problems` unchanged in what they
write, so a reordered sheet sends the same body; `Section`, `FormField`, `TextField`,
`Button`, `Icon`, `Text`, `SwitchRow`, `ChoiceRow`, `DateTimeRow` and `Notice` for the
drawing, with the chip drawn by the `View` and `Icon` `TagsField` already used; `noun`
for the kind a sheet is titled with and `kitCopy`'s existing `newNamed` pattern for the
word over `editNamed`. **Added** — `formSections`, `commandSections`, `orderControls`,
`joinList`, `entryHoldsSeparator` and `valueHoldsSeparator` in the core, because the
inventory held `formControls` (the set) and no answer to "in what order, in what
blocks, and which of these words is a person's"; `FormBlock` and `FormWords` are its
two shapes. Five words joined the copy table in both languages (`editNamed`, `addTag`,
`addTagTo`, `removeTag`, `commaInValue`), and two more joined it in this round so a
Portuguese phone reads Portuguese where the sheet explains a control it did not get
words for (`changedByCommand`, `identifierOnly`), which the table already held in
English only as a literal inside the derivation. `required`/`optional`, which the table
already held and nothing drew, are now drawn and announced by the sheet — a refusal or
an affordance with no word in the table is one no phone can say. **Made reusable** — `formSections`
hands a renderer pack the form as data (blocks, labels and ordered controls), so a
custom sheet takes the kit's order without redrawing it; `orderControls` orders any
control list against any identity field, which is what a command argument needed and
what a filter sheet will want next; `FormField` is now the only place a field's name,
its required-or-optional word and its refusal are drawn, so a control that grows a help
line cannot disagree with the label above it; and the two comma predicates are the
storage rule itself, which any other writer of a comma-joined field can ask.

A sheet keeps what a person typed and says exactly what to mend. **Validation runs on
Save**: `problems` answers a sentence per field — "Enter a title." for a box one types
into, "Choose a due date." for a value one picks, "Enter a valid number.", "Enter a
valid date and time." — and every one of them exists in `kitCopy` in English and
Portuguese before a screen may hold it, because a fragment off the wire ("is not a
number") is a second implementation of the copy table in a language nobody reads. The
phone refuses only what the catalogue makes it certain of: required-and-empty, not-a-number,
not-an-instant, and the two list rules above. A range, a unit, a uniqueness, a permission or
a tenant policy stays the server's, arrives as a 422 whose `body.` prefix the transport strips,
and is drawn under that field in the same shape. **The sheet then asks for one field**:
`firstProblem` names the first control _in the sheet's own asked order_ that carries a
sentence — never the first key of the refusal, which arrives in wire order — the hook
holds it as `awaiting` and counts its refusals as `refusals`, the organism focuses that box's
ref and asks React Native's `scrollResponderScrollNativeHandleToKeyboard` to lift it above
the keyboard; typing into the field awaited is what clears it, and a second Save over a
sheet nobody mended asks for the same field again, which is what the count is for. A
refusal about a control with no box to focus (a choice, a date row, a switch, a tag box)
focuses nothing: `FormField` announces `label: error`, its error line is a
polite live region and the notice above the fields is `urgent`. **Dirty means changed, not
touched**: `changedFields` compares each control's effective value with the one the row
arrived with, as what the value means — an instant by the instant it is, because the date row
writes `timeWire` with milliseconds and the server spells the same instant without them, and
a switch by on or off, because a row that stored nothing is off — so typing a word and putting
it back, confirming the date the record already carried, or flicking a switch on and back asks
nobody's permission; the one predicate is used by the sheet, by a command's argument and by the
singleton, and the guard covers Cancel as well as system back and the swipe gesture. **One
dismissal, one question**: Cancel asks its own answer and then leaves with the guard lifted by a
render, because a `router.back()` taken while `usePreventRemove` is armed is handed back to it,
and a person who was asked twice for the same draft was not asked once. **Values survive every
failure** — a refused save, a 422 under its field, a 500 (`failure.saveFailed`), a
transport that never answered (`failure.uncertain`, and a save is never replayed), a 409
(`failure.revision`, no silent overwrite), a 401 (the draft stays filed under this address
for this person) — because no failure path writes `held`. **Save exists only while the
row is on screen**: the button is disabled outside `editing` and the transition rechecks
`phase` and `offers` from inside, so a sheet reached by a link cannot write what it never read.
A **singleton** gets the same protection: the same question before a dirty draft is thrown
away, the same Save guard, an Edit drawn only once its row has been read, and a PUT built by
`writeControls`, which carries every field this client may write — the ones the form drew, the
hidden ones the author keeps as plumbing and the immutable echo of what the read returned —
so a whole-row replace clears nothing by omission, while `id`, `createdAt` and `updatedAt`
never travel back. What nobody is asked to type travels **unparsed**: a hidden or frozen field
carries the row's own value (`Control.echo`), not that value re-spelled through an editor's
one-string form, which is a spelling with no comma inside one list item and no empty item —
`["North, West", "", " "]` stays three items rather than becoming `"North, West, "` split back
into `"North"` and `"West"`. **A landed write says so**: one success haptic and one sentence that
outlives the screen that wrote it — the shell holds one slot, filed by the destination address
the writer names (`say`) and read once by the record that lands there (`heard`), for the
visit it was heard in: a focus that hears nothing draws nothing — "Note
created" after a create, "Changes saved" after an edit and after a singleton's PUT, drawn as
an `ok` `Notice` with a polite live region beside the row it is about.

**Reused** — `problems`, `values`, `formControls`, `formSections`, `orderControls`,
`control`, `text`, `numberValue`, `timeValue`, `noun`, `fieldLabel` and `refusalFields`
for what a refusal is made of and what a body is made of; the copy table's own
function-shaped entries (`untitled`, `deleteQuestion`, `deleteAction`) as the model for
the sentences that name a field or a resource; `TextField`'s existing `forwardRef`,
`Screen form`'s keyboard handling, `FormField`'s announcement and `Notice`'s `ok` tone
and live region for the drawing; `usePreventRemove` and `src/ui/chooser.ts`'s `confirm`,
already used by three screens, for the question; the shell's existing holders (one draft
keyed by its address, one write counter per resource) for the two things that must survive
a screen. **Added** — `changedFields`, `firstProblem` and `writeControls` in the core, `Control.echo` — the row's
own value for a field nobody is asked to type, which `values` sends unparsed — `awaiting` in
both hooks, and ten sentences in `kitCopy` in both languages, because the
trace's inventory held the set of controls and the body builder but no answer to "which
field changed", "which field is being asked for" or "what does a whole-row replace
carry", and no sentence anywhere in either language for a required field, a discarded
draft or a write that landed; `ShellValue.say`/`heard` because nothing in the tree carried
a sentence across a screen — the shell already owns exactly that kind of transient twice
over (a draft, a write count) and nothing else does. `Screen` gained one optional
`scrollViewRef`, which is the handle the page needs and no rule of its own. **Made
reusable** — `writeControls` is the whole-row body, so any future PUT of one row (a
settings resource, a masked form) keeps the fields it was not shown without learning what
hidden means; `changedFields` and `firstProblem` are two hooks' worth of decisions in the
core, exported, so a custom renderer pack gets the same dirty rule and the same field to
focus; `FormWords` is now the whole seam between a refusal and its sentence, so the core
writes no English at all; and `say`/`heard` is one sentence for one address, which is the
carrier the next "the write landed" moment will need instead of a toast.

What this does not reach, stated where a reader would look for it: four controls carry no
box to focus — a choice, a date row, a switch and the tag box — so their refusal is announced
where it stands and the keyboard goes to the first box that can be typed into; the sentence
about a list item of the wrong type is still English written in the core ("contains a value
that does not match its item type"), because no phone's table holds it in either language
yet; a singleton PUT echoes what the read returned for an immutable field, and this kit has
no live server to prove the kernel accepts its own echo rather than refusing it as a write
of a field nobody may write; the _tag box_ has no spelling for one item that carries a
comma, so a stored item written some other way is drawn as two chips and saved back as two —
what a person sees there is what the write holds, and nothing is rewritten behind their back,
but nobody can type such an item back in, because the box refuses the separator on entry;
and the English article rule chooses its article from a label's first letter rather than its
meaning, so a field labelled `URL` is asked for as "Enter an uRL." and one labelled `Hour`
as "Enter a hour.".

### The server's resolved policy

A catalogue entry may carry `resolved`, the presentation policy the server settled for the
request's language. `readPolicy` (`src/core/catalogPolicy.ts`) accepts a block only whole:
a `policyVersion` no newer than `SUPPORTED_POLICY_VERSION`, every member the readers use
present and typed by the generated schema, and every field *name* the block states a field
of the entry — its title candidates, its pill, its summary line, its picture and its summary
list, every part of its layout, its sorts and its filters — with every field of the entry
described in return. The empty name is skipped: the kernel prints `""` for the member it
left unset on purpose, which is an answer rather than a pointer. An absent block is an older
server and says nothing; a newer, malformed or inconsistent one is named once through the
catalogue's `notice` and the *entry* is then drawn exactly as before, never half by each
rule. Under a supported block `src/core/derivePolicy.ts` answers for `noun`, `nounPhrase`,
`fieldLabel`, `enumLabel`, `enumTone`, the missing and yes/no words of `display`,
`label`/`primary`/`rowPrimary` (candidates, then the identifier, then the empty title),
`listColumns`, `onList` and `onRecord`, `formControls`' order and the order `formSections`
draws inside a block (the block's own, not this file's rank), `sortFields`/`sortOptions`,
`statusField`, `listPreview` and `finishedValues`. Where a list-membership question has two
answers in one block, the layout list wins: `layout.columns`/`create`/`update` say what that
screen holds, and `fields[].onList`/`onRecord` answer it for the fields no list names. An empty `titles.preview` or `titles.status`
is the server saying no summary line and no pill, so the record draws neither rather than
asking this file's heuristic for a text field or an enum to put there. A sort sheet under a
block is the block's declaration — its queries, in its order, under the words it resolved —
with the phone's "Newest first" and "Oldest first" said in place of a declared order on one
of the two stamps. Instants and relative time stay the phone's own device formatting.
**A stepped form is judged before anything draws it.** `layout.forms` states, per form, that
the sheet is walked (`layout: "steps"`) and which fields each step asks. `stepsAreSound` holds
that block to the kernel's own checks in `kit/entity/present/forms.go`: the layout word, a
step list with something in it, a key of its own per step, a label the sheet can draw, at
least one field per step, no field asked on two steps, and — for the create and update forms,
whose editable lists the block itself carries — steps asking exactly `layout.create`/`update`.
A step's copy follows the kernel's `stepCopy`: a literal verb that is not blank, at most one
`{answer}` token and no other brace, and with a token an answer field on that very step and a
non-empty empty label. One broken member costs the entry its whole policy and is named once,
the way every other part of the block is, because a half-read step list would decide which
boxes a person can reach. What survives is read by `src/core/form/steps.ts` (see _How a form
asks_), and `deriveStepper` refuses to model a stage whose word holds no text — which is why
the sheet's blocks and its header `Save` are keyed off the rail that drew and not off the
declaration: a walk that cannot be drawn leaves the flat sheet, door included.

A refusal's `violations` name the form's fields; `errors` is read only when they name none.
`tests/parity` holds the kernel's reviewed cases byte for byte, `npm run check:parity` proves
them against `parity.source.json`, and the phone's models are held to each.

**Limits.** Not yet readers: `commands[]` confirmation copy, `deck`, `list.filters` (its
options and kinds; a block naming a filter's field is still checked against the entry),
`layout.sections`/`overview`/`information` (a form still groups by the legacy `sections`
hint, and the record's blocks by it), `layout.forms.inputForm` as a drawing (its steps are
read and judged, and this build opens no typed read to walk them), `summary`,
`titles.summary` (the row's cells still
follow `summaryFields`), `reading.precision`, `writeControls`' extra fields,
`identity.icon`/`group`/`description`, `titles.cover`/`thumbnail` (they stay on today's
derivation under a supported block), `fields[].editable` (`layout.create`/`update` already
own who is asked and in what order, so a second answer would only be able to disagree) and
`list.defaultSort` (the phone keeps its own newest-first default). Because `defaultSort` is
unread, a block whose declared orders name none the phone can put back to the default (the
wire's `""`) offers no order group at all: the list stays in the server's own order rather
than opening a sheet a person cannot leave. A member the server leaves unset is printed by
saying nothing, so the pin names the kernel commit that prints an unset `resolved` member
absent; the strict `appResources` operation then takes the golden with its resolved blocks
in. `readPolicy` still admits a `null` for `identity.group`, `reference`, `reading.money` and
`reading.time`, because a server older than that commit writes `null` for the same absence and the
entry keeps the policy it was given either way. The five kernel presentation copies this repository
holds name one commit of it (`2499b3679005623b1bc73e2b2cf7ae88d81da004`): the golden, the HTTP
document, the parity fixtures, `testdata/catalog.choices.json` and `testdata/catalog.deck.json`,
the last two the captures the choice and step readings are proved against. Each copy's record
is proved by the script that reads it, and
`tests/the-phone-s-kernel-copies-name-one-commit.test.ts` refuses a re-pin that moves one copy
and leaves the others answering for a kernel this phone no longer runs. Two members
(`resolved.fields[].figure` and `reading.precision`) are still printed `null` there, and the
`ResolvedReading.precision` the document generates is nullable while `figure` is unknown to it, so
neither costs a read.
The section has a second reader with a different fallback: `src/core/choice.ts` reads each field's
finite choice out of the same block field by field, so a block this file refuses whole still answers
the choice questions it states on its own. One reader of the section, answering both questions behind
one fallback, is the open question.

**Reused** — `parseCatalog`'s `notice` fallback, `View<>`, the generated `zResolved*` schemas,
`verifySource`'s source-record idiom, `fieldLabel`, `enumLabel`, `label`, `sortOptions` and
`formControls` as the readers' callers, and `problem()` in `src/effects/api.ts`; the stepped form
reuses that one `notice` ending rather than a second channel, and the source-record and
`check:parity` idiom for its two new captures. **Added** — `catalogPolicy.ts`, `derivePolicy.ts`,
`scripts/parity.ts` and `tests/parity`, because nothing read `resolved`, nothing held Go's
canonical-JSON hash, and the kernel's cases live in another repository; `stepsAreSound` for the
step judgements zod cannot state between the two lists the block already carries, and
`src/core/form/steps.ts` for the walk, because nothing read `layout.forms` or answered which step
a refusal belongs to. **Made reusable** — `readPolicy` and the `Policy`/`PolicyField` types for the
remaining readers listed above, `tests/fakes/policy.ts` and `parityEntry` for any test that
needs a supported entry, and `steppedForm`, `stepBlocks`, `stepProblems`, `stepOwning`, `stepVerb`
and `walkSteps` through `src/core/form/index.ts` for the next screen that walks a form.

### How a finite choice is drawn

A field with a declared `ChoiceSet` is drawn the way the server says, not the way the phone
guesses: every catalogue entry carries a `resolved` section whose field names the surface
(`tiles`, `chips`, `figure`, `swatch`), the answers in order, the cardinality, the maximum, the
empty policy and the compiled artwork. Three molecules draw the four appearances — `ChoiceTiles`
(a card per answer, its picture the largest thing on it), `ChoiceChips` (a wrapping line of
words, and the same line with an answer's colour beside its word for `swatch`) and
`ChoiceFigure` (the compiled picture above the answers that name it) — and one `ChoiceSurface`
draws the question's name, its reset and its refusals around them. Each answer is a radio or a
checkbox carrying its own label, at least `hit` points tall; a change is felt through the `onTick`
the screen that owns `expo-haptics` supplies, because a molecule reaches no transport.

**Reused** — `Button`, `Text`, `Notice`, `kitStyles` and `chosenState` for the answers and their
chosen state; `hit` from `src/ui/scale.ts` for the touch target and `Motion` for reduced motion;
`deriveChoices` and `ChoiceGroupModel` as the one semantics of a choice, grown to the second
cardinality rather than copied; `HintNotice` as the only channel a malformed hint reaches a
developer by; the pinned-fixture and provenance shape of `testdata/catalog.pictures.json`.
**Added** — `src/core/choice.ts`, because the `resolved` section is a fact nothing in this kit read
(its member was stripped by zod in silence) and its fallbacks are the parser's, not a component's;
`ChoiceTiles`, `ChoiceFigure` and `ChoiceSurface`, because no existing molecule drew a card, a
compiled artwork or the lines that stand around every appearance; `pickChoice`, because "what a
tap does to the held answers" — the exclusive answer, the replace-oldest maximum — was a rule no
existing owner carried.
**Made reusable** — `Field.choice` as the phone's reading of any declared choice, so a screen,
a form or a filter reads the same semantics instead of the schema's `enum` alone; `pickChoice`
for any surface that lets a person hold several answers; `ChoiceSurfaceProps` (`model`,
`onChange(ids)`, `onTick`) as the contract a fifth appearance would join; and
`testdata/catalog.choices.json`, the first served capture in this kit that carries a resolved
choice at all.

**Limits** — the reading is hand-declared here, exactly as the `presentation` hints are: `resolved`
enters the catalogue schema as `unknown` because it is presentation, and the two members these
surfaces ask for beyond the generated `ResolvedField` — `choice` and `figure` — are named in
`src/core/choice.ts`, not in `src/generated`. A `swatch` is drawn as
a chip whose artwork is the answer's declared colour, because that is all the kernel's fourth word
asks beyond chips; a picture or a file answer is read as no artwork and says so. The figure's own
marks are not re-stroked when an answer is chosen — the chosen state is carried by the answer
control beside it. No screen yet offers these appearances: a form's many-answer value plumbing
(a `string[]` on the write, and the same on the read) is the next change, and until it lands the
appearances are drawn by their tests and by the gallery: the home page's card options are asked
again as `choice-tiles/default` and `choice-figure/default`, the same question on each surface.

## Design

Every PlatformKit phone app is composed from this directory, so the kit is why
one app looks like the family. Its bar is a screen a person would keep using,
not a control that renders, and the kit commits to six things the checks name:

- **The palette is the token fixture's.** No component writes a colour.
  `src/ui/theme.tsx` names roles, `src/ui/tokens.ts` is generated, and an
  interaction state is a linear-light mix of two palette roles
  (`src/core/color.ts`), so both modes move together.
- **Ink is legible on what it sits on.** Every pairing the theme hands a
  component is measured in `tests/ui/contrast.test.tsx` against WCAG 2.2 §1.4.3
  in both modes. A control's edge is `state.outline`, which holds 3:1 on paper,
  on canvas and on the muted surface; a hairline between two rows is
  `borderDefault` and claims nothing it does not identify.
- **Type says what a thing is.** Display, title, body, caption, eyebrow and mono
  are named roles in `src/ui/scale.ts`; money, clocks and counts are
  `type.numeric`, whose tabular figures line up down a column.
- **One control body.** A button, a field, a search strip, a switch row and a
  choice row all take `hit` as their height and `state.outline` as their edge, so
  a screen reads as one instrument rather than five.
- **A state is visible or it is not a state.** Hover, press, selection, busy,
  disabled and loading come from `Theme.state` and are drawn by every control
  that can take them; `prefers-reduced-motion` stills what moves.
- **The gallery is the measure.** `src/core/galleryPages.ts` names fifteen pages,
  each led by the one specimen its screen is about — the page's other states beside
  it where two phone columns fit, and behind the kit's own disclosure on a phone,
  where a fold holds one screen rather than a screen's variants — and every family the
  kit owns is the specimen of exactly one page. Photograph `/gallery/<page>` at
  390 and 1440 and judge those pictures against a reference screen the kit is
  held to; a component nobody has photographed is not finished. The bar those
  photographs are judged against is named row by row in
  `design/references/refs.json` — the screen, why it was chosen for the pattern,
  what the kit draws against it today — and each row carries its own picture:
  the kit's specimen for that pattern, committed beside the manifest at 390 px
  (`ours_case` names it, `?case=<specimen>` opens it, and
  `tests/references-capture.case.mjs` re-photographs every row). Mobbin licences
  a screenshot to its subscriber, so no reference image byte is copied into this
  public source; `source` with `store_sha256`/`store_bytes` names the bar in the
  reference store, and `npm run check:references` proves the store still holds
  exactly those bytes and that every committed picture is the bytes its row
  promises.

**Reused** — `Button`'s existing shape list and `s.plain`'s way of painting an edge
in the surface the word sits on, `Section`'s `divided` line (now the kit's only row
separator), `Badge`'s neutral tone, `copy`'s existing "Not set" words, `Clock` and
the `now` a screen already hands `useFeedback`, and `Intl` for both the clock and
the distance. **Added** — `ownZone` on `Presentation` and `presentedInstant` in
`src/core/presentation.ts`, because a formatter that asked the device which zone it
is would put a mutable default in the core and leave every zone test depending on
the machine, and nothing existing could say one instant twice — the words a glance
reads and the whole date-time a reader speaks; `ListScreen`'s `grouped` branch,
because both list templates lay out each item on its own and cannot hold one card
across the rows they recycle; `hostLabel` and `plural`'s mass-noun set, because the
derivation layer held neither and a screen may not parse an address inline.
**Made reusable** — `presentedInstant`'s shown/exact pair, so any value cell, any
detail row and the activity trail state one instant in two spellings (the trail's
own private relative-time table is gone with it), `civilDay` for any sentence that
needs "yesterday" rather than a date, and `ListScreen`'s `grouped` flag for the next
screen that holds a handful of things a person may open.

## Consume the shared native source

### A module's own screen

A catalogue entry can name the screen it wants. `renderer` on an entry is
presentation only: `{ "name": "task/tasks", "min_shell": 1 }` says draw this
resource with the pack keyed `task/tasks`, and that only a shell from version 1
onward can draw it. `packKey` picks the pack; `key` still names the resource, so
one module's screen may be another module's row, and every read, write, door and
permission keeps coming from the entry, the session and the server's answer —
which pack draws a row is not an authorisation and cannot widen what a caller may
do. A name this build does not carry, or a `min_shell` above this build's
`SHELL_VERSION`, draws the generated screens; only the second case adds a quiet
line in the page's foot, because that one is a screen a person can get by
updating the app. `SHELL_VERSION` belongs to the kit rather than to a product:
a pack ships inside the app binary, so a product cannot claim a capability the
shell it composes lacks. A malformed `renderer` — no name, a `min_shell` that is
not a whole number at least 1 — is read as no pack rather than refused: a slip in
a screen's name may cost a person the screen made for them, not the catalogue.
Whether a server ever prints the key is the kernel's; this build reads it as
optional, on the same terms as version-2 `operations`.

A pack screen reaches typed data by naming a generated operation, which is the
reason a bespoke screen is worth writing at all:

```tsx
import { useOperation } from "@septagon-oss/platformkit-mobile/screens/useOperation";

const read = useOperation("taskTaskRead", id === undefined ? undefined : { path: { id } });
const title = read.data?.title ?? "";
```

`useOperation(name, input)` answers `ReadState` — `requested`, `data`, `error`
and `reload` — and an `input` of `undefined` asks for nothing. The name must be a
key of the generated `Operations`, and the body is what that operation's own
generated validator accepted (see [HTTP contract](#http-contract)); a field the
pinned document does not print fails `tsc` rather than drawing an empty line on a
phone weeks later. `OperationName`, `OperationInput`, `OperationData` and
`ReadState` come from `@septagon-oss/platformkit-mobile/renderers`, and a pack reaches the
document through them rather than through the generated client. A write is the
same surface, `api.operations.taskTaskAssign({ path: { id }, body })`, and
`@septagon-oss/platformkit-mobile/screens/useCommand` exports the two hooks the generated
screens use: `useCommandRun` sends a command with an argument to its own sheet
and asks about one without, `useCommandAsk` is the asking half. So a pack that
draws the entry's commands asks the same questions, posts to the same address and
re-reads on the same write count. What stays internal is the generated screens'
own hooks — a pack composes a screen, it does not take over the shell's.

The kit's one example is
[`src/examples/taskRenderers.tsx`](src/examples/taskRenderers.tsx), exported as
`@septagon-oss/platformkit-mobile/examples/taskRenderers`. It is a pattern a product copies,
not product UI: `app/_layout.tsx` keeps passing `defaultRenderers`, so no screen
a person walks comes from it. It shows the one thing that earns a bespoke screen
— `slaDeadline` and `slaBreached` read as one line, which no column can say —
and nothing else: its title, priority and state are the columns the schema
already describes, and its commands come from the entry through `Actions`.

**Reused** — `parseCatalog` and its additive-optional extension, `Entry`, `key`
and the version rule in `core/catalog.ts`, the `Notice`/`Spinner`/`Badge`/`DetailRow`/`Section`
atoms and molecules, the `Actions` organism and the `Screen` template,
`useFeedback` and the copy table, `rowCommands`, `useCommandAsk`, and the
`createApi(url, fetchLike)` double the contract tests already drove.
**Added** — `RendererRef`, `SHELL_VERSION`, `packKey` and `shellReady` in core,
`OperationName`/`OperationInput`/`OperationData`/`ReadState` in the pack
contract, `useOperation` and `useCommandRun` in `src/screens/`, and the example
pack — because `defaultRenderers` was empty and no screen read a generated
operation at all (`grep -rn "api.operations" src/screens` printed nothing on the
commit this change starts from), so there was no accessor to extend and nothing
existing could carry a read whose type comes from the document. **Made
reusable** — `useOperation`, exported as `@septagon-oss/platformkit-mobile/screens/useOperation`
for every pack a product writes, and the one shared `useCommandRun` now behind
both the generated detail and a pack's own screen,
`fakeApi(operations)` with `answering`/`recorded` in `tests/fakes/shell.ts` so
the next screen is tested over a transport and its validators rather than a
stub, and the exported example itself.

**A product's own pack** — `src/packs/decide.tsx` is the Decide module's screens, keyed
`decide/questions` and `decide/card` and passed to `Shell` beside the generated ones: opening a
question asks for its title and its options in one sheet and posts the whole draft to the service
that opens it, because the entry is mounted read-only and holds no create; voting is the deck, the
`decide/card` entry's own declared directions, with the question a person is voting on named beside
the card and a match announced once per match rather than once per screen; the result is the
ranking as the module ranked it, with the tally, the faces and the winner and no local sort; and the
invite sheet holds the roster, the link the minting call printed and its expiry, with no credential
read back after it was minted. **Reused** — `DeckSession` (the deck's own session, exported so a
product's deck screen is the same screen), `useResourceList` and the `ResourceList`/`ResourceForm`
organisms, `useCommandOutcome`, `useOperation`, `usePictures`/`useDirectoryPeople` for faces and
cover photos, `deriveMeter` for the bar and the percentage beside it, `avatarStack`, `rowCommands`,
`nameKey`, `timeText`, the atoms and molecules and the `Screen` template, and the copy table's
`choice`/`state`/`fields` phrases. **Added** — `command.bindings` in the entry and
`boundArguments`, which fill a command's server-bound arguments from the row the command runs on and
send no body at all when the row cannot answer for one (the vote commands carry
`{questionId: "questionId", ifRevision: "voteRevision"}`); `readDeck` accepting such a command, which
it used to refuse as unaskable; `DeckReceipt.accepted` and a deck `header` slot, so a deck can name
what it is a deck of without reaching for a screen ref; `personPointers`, which points bare voter ids
at the directory only when the catalogue offers it readably; and the Decide vocabulary in the copy
table, English and Portuguese, because every string on these screens is the kit's. **Made
reusable** — `DeckSession` exported from `src/screens/`, which is what let a product's deck reuse the
mechanism instead of copying it, and `src/packs/` as the place a product's pack lives, linted by the
same import rule as the example pack: it reads through the shell's `Api` and never touches
`effects/`.

### A look the module composed

**`src/packs/outfit.tsx`** is the outfit module's two screens — the wall of looks and one look — keyed
`outfit/look` and passed to `Shell` beside the generated ones. The module ranks and composes; the
phone draws what it answered. The wall shows the looks in the order the read ranked them, each named
by the look's own name and captioned by the module's own pieces line, with the answers it was
suggested with above them and one control below that asks for the next window; the look shows the
flat-lay, its name, the season and style it was composed under, one line per piece with the colour
that paints it, and the two doors — the next idea, and the person's own copy of this one, the second
drawn only where this build answers for a copy. A refresh that refused is a sentence above the look
it refused, which stays on screen as the last copy this phone read, and no keep is offered against it
while that sentence stands. A look is
addressed by the key the module keeps it under (its recipe plus the colours actually worn), which is
why one look opened from the lookbook and from a suggestion is one record and two recolourings of one
recipe are two. The window's position comes back in every answer: the next ask starts where the
answered window ended, and a window the module ended leaves no door, not a disabled one. A body
outside the module's shape is refused by the wire as a whole, so no look is ever drawn with a member
missing. The questions, the pictures, the heart and the lookbook stay the kit's.

**Reused** — `MasonryWall` (the two-column wall, its cells, its states and its foot control),
`deriveMedia` and `deriveMediaHero`, `MediaHero`, `usePictures` (the composed flat-lay goes through
the session's own picture door and the product's SVG surface), `useSaveToggle` and `SaveButton`
untouched, `Screen`, `Stack.Screen`, `StateView`, `Text`, `Button`, `build`/`deriveState`/`readPhase`,
`noun`, `rowAt` and `screenPath`, `sourceRef` and `expectedSourceVersion` — which the pack never
calls itself, they are `useSaveToggle`'s — `refusalOf` and the copy
table, and the `fakeApi` of `tests/fakes/shell.ts`. **Added** — the pack itself (`wire`, `read`,
`model` and the two screens) because the module mounts no route, so no generated operation could
carry its reads and `definePack` has no key to declare: it stays the plain `Renderers` record
`src/pack.ts` names as the escape hatch; the wire, because nothing here validated the module's JSON
and the shape is the module's; the `Swatch` atom, because a colour a person *reads* (a disc, named
where the disc is the only place that colour is said, and decoration where the word already stands
beside it, never pressed) is not the fingertip-sized colour band that is part of a pressable answer,
which stays
inside `ChoiceChips` with the press it belongs to; `copy.outfit` in both languages, because a word a
prop supplied could not be localised with the rest of the screen; and the flat-lay's frame in
`ui/scale.ts`, because a composed reference names no stored file to probe and a screen may not guess
an aspect from a name. **Made reusable** — `MasonryWall`'s `header` slot and `deriveMedia`'s
`moreLabel` (a wall owns the only scroll view its page may have, and the sentence its foot prints is
the collection's, not the organism's), `MediaHero`'s `ground` (a record's own colour, painted while
its picture arrives), the `Swatch` atom exported with the rest of the atomic layer, and
`tests/fakes/outfit.ts` — a fake that holds the *service's* decisions (the key grammar
`of1:<recipe>:#HEX-#HEX-#HEX`, the uppercase hexes, the four-at-a-time window that rotates back to
the front of the ranking rather than running short, and where it ends) rather than a per-test guess —
beside
`tests/fakes/wall.tsx`, which draws every cell of the wall for any screen that counts them.

### Shared feedback

**Reused** — `EmptyState`, `Notice`, `Skeleton`, `Spinner`, `Button`, `DateTimeRow`, native
accessibility primitives, `ThemeProvider`, scale and Gallery carry the shared
feedback family. **Added** — pure `deriveCopy`, `deriveState` and explicit
presentation/clock inputs own translated copy and recovery eligibility, because the
existing atoms had no common state or recovery contract. **Made reusable** —
`StateView`, the `StateFeedback` screen adapter and 31 Gallery cases let another
renderer pack use the same states, actions, tokens and conformance examples.

Obtain an immutable English or Portuguese copy bundle with `deriveCopy('en')`
or `deriveCopy('pt')` from `@septagon-oss/platformkit-mobile/core/derive`. Pass an explicit
`Presentation` with that bundle, locale, timezone, week start, sampled UTC clock
value and motion preference to `deriveState(input, presentation)`. Language and
formatting locale are independent; the gallery includes `en-GB`, `pt-PT` and
`pt-BR`. Unresolved motion preferences stay reduced.

`deriveState` returns either `{ ok: true, value }` or `{ ok: false, issues }`, with
no partial model. Render a successful value through
`@septagon-oss/platformkit-mobile/screens/StateFeedback`, passing `model`, `onAction(id)` and
an optional `testID`. This screen adapter composes the pure
`ui/molecules/StateView` and performs iOS announcements when the message changes;
Android and web use native live regions. The caller owns all reads, writes,
navigation and reconciliation. A callback reports intent, never success.

Use empty for a successful zero result, offline/error for failed reads, and
success only after a confirmed result. An immutable error refuses a retry-read
action. An unknown write outcome allows reconciliation or dismissal; it refuses
resubmission and read-retry intents. Busy actions keep their labels and suppress
activation; disabled actions require a visible reason. A success stays until its
caller dismisses it. `updatedAt` labels stale readable content in the supplied
locale and zone; forbidden or missing records cannot carry that stale label.

Direct consumers upgrading their source pin must migrate these required props:

- `Skeleton` and `Spinner`: `label` and `motion`; Skeleton also supports
  `lines`, `rows`, `detail` and `media` variants.
- `Notice`: explicit `announcement` (`none`, `polite` or `urgent`); its action
  accepts busy/disabled/reason, and it can offer a secondary action.
- `ChoiceRow`: `copy={copy.choice}` for its placeholder, cancel word and hint.
- `DateTimeRow`: `copy={copy.dateTime}`, `initialValue: Date` and `timeZone`.
  Its Set action uses the supplied date, and both native dialogs use the supplied
  zone. Required or disabled values cannot be cleared. Native picker language
  follows the operating system; the surrounding labels come from the bundle.
- `ListScreen`, `LoadMore`, `Home`, `ResourceList`, `ResourceDetail`,
  `ResourceForm`, `SignInForm` and `Activity`: `feedback`, obtained from
  `deriveFeedback(copy, motion, { locale, timeZone })`. The in-repository screens
  adapt native preferences in `useFeedback`. `retry(feedback, callback)` now
  gets its label from core; the old Notice export re-exports that same helper.
- The `ResourceForm` organism also requires `initialDate`, and takes `blocks`
  (the ordered groups `formSections` and `commandSections` answer) where it took a
  flat list of `controls`: one name is drawn above every control, so the organism
  needs to know which control begins a group. `FormField` takes `copy` (the kit
  bundle) when it is to mark a field required or optional, `TagsField` requires
  `copy` and takes the optional `announce` (the accessible name the sheet derived,
  which a box outside a form does not have), and `SwitchRow` no longer takes `help` —
  the name above the switch is where help belongs. `problems(controls, held, words)`
  takes the reader's own bundle, because the sentence it refuses with is a word, not a
  format string.
  `sheet(title, entry)` is titled by the catalogue's declared name for the kind,
  with the wire word from the address when no entry has been read. Generated form,
  command and singleton screens accept an optional `Clock` and sample it once
  per mounted screen; the default device clock lives in screen composition.
- `timeText(date, formatting)`, `display(field, value, formatting)` and the
  record's three answers (`recordHeader`, `recordSections`,
  `recordInformation(entry, row, formatting)`) require explicit formatting. The
  latter four also use its copy bundle. `Value` and `Labelled` receive that value as
  `presentation`. There is no mutable device-default date formatter.

The public `@septagon-oss/platformkit-mobile/ui/gallery` export accepts `presentation`, optional
complete `palette`/`fonts`, `initialCaseId` and `initialMode`. Choose a rich-state
case, language, locale and appearance in its controls. Hover, press and focus
cases contain real controls to operate; their names do not simulate interaction.
Passive loading states have no disabled/selection actions. Supply `renderState`
with the `StateFeedback` adapter for iOS speech, as the reference gallery screen
does. The older primitive samples remain English fixtures; this delivery does
not claim whole-application localization.

The rich-state unit/component suites and browser checks exercise the reference
palette and isolated supplied-token fixtures. Android/iOS devices, VoiceOver,
TalkBack, largest native text settings and consuming products' palettes still
need their acceptance runs. The rich-state slice introduces no catalog/API contract.
The later families below add native dependencies. Activity now receives a derived model; raw event adaptation and the explicit clock
belong to the generated screen/core adapter.

### Shared collection, workflow and presentation families

**Reused** — the existing core catalog helpers, state atoms, Button, Row, Section,
ListScreen, native modal/canvas, theme, scale and renderer-pack wiring carry these
compositions. **Added** — focused pure factories in `core/derive` provide collection
selection, surface dismissal, audit values, steps, availability, civil-day calendars,
exact money/quotes, plans, map markers, media selection and chart projections.
**Made reusable** — named UI subpaths and the public Gallery let products supply
content, callbacks, locale, language, theme and native rendering resources once.

Use the inputs and named factories in the
[component contract](docs/shared-mobile-components.md#explicit-factories-and-source-migration).
Every factory returns `Result`; render its value only after checking `ok`. All
refusals retain their classification and return no partial value. Models are
immutable copies, and caller drafts are neither frozen nor mutated. No factory
fetches, writes, reads the current clock, or changes another caller's configuration.

The existing UI export patterns now include `DataList`, `Activity`, `Stepper`,
`SlotPicker`, `Calendar`/`WeekCalendar`/`AgendaList`, `ProductCard`/`Cart`/`OrderSummary`,
`PricingTiers`/`PlanComparison`, `MapWithList`, `PhotoGallery`/`PhotoViewer`/`MasonryWall`,
`AreaChart`/`BarChart`, and their smaller controls. Templates include `DetailSheet`,
`SidePanel`, `BuyBar`, `MoreFilters` and `SummaryDetail`. `DisclosureSection` permits
at most two levels; move a third level to an explicit detail page or sibling sheet.
Keep essential fields and primary actions visible without opening a disclosure.

**Reused** — the generated palette, `themeFor`, `scale`, `Section`, `Row`, `Text`,
`Button`, `TextField`, `Notice`, `Spinner`, `Icon` and the gallery's own case
vocabulary carry the phone's interaction states. **Added** — `ProgressMeter`,
`TabBar`, `SearchField`, `MiniPlayer` and `ConfirmDialog`, with `core/progress`
holding the one ratio rule a meter and a player share and `core/navigation` the
tab ceiling and the search count; `core/color` holds the linear-light blend and
the WCAG 2.2 §1.4.3 ratio. **Made reusable** — `Theme.state` (hovered, pressed,
selected, disabled, divider, outline, scrim, raised) is the only place an
interaction colour is mixed, `themeFor`'s `contrastPairs` registry is measured
over both palettes by the suite, and the fifteen `/gallery/<page>` pages show
every family in screen-shaped compositions.

`ResourceList` now requires `presentation` in place of `feedback` and delegates
to `deriveCatalogList` and `DataList`. `Activity` requires `model` from
`deriveActivity` or `deriveEventActivity`, with `onMore`, `onRetry`, `onExpand` and
`onOpen` supplied when offered. `ResourceDetail.activity` accepts those props.
All in-repository consumers have migrated. Direct source consumers must migrate
these props when updating their pin; source compatibility is not implied.

Money is canonical int64 decimal strings plus an explicit currency/exponent pair.
`cartTotals` uses bigint and is independent of formatting. `deriveCart` offers
checkout only with a matching fresh quote and eligible lines; its callback echoes
quote ID and revision. The caller must discard quotes when options or quantity
change and recheck the binding authoritatively on the server. Slot selection echoes
the supplied availability version and never reserves capacity. Step callbacks ask
the caller to validate, save, finish or reconcile; use `stepTransition` to apply
adjacent-step outcomes. No draft storage or payment workflow is hidden in the kit.

The native rendering adapters are `screens/NativeMap`, `screens/NativeImage` and
`screens/NativeZoom`. Map and image resources are prepared by the product's effects
and carry explicit scope/version identities. The MapLibre adapter takes a supplied
style URL, uses no default city/location service, and ignores late scoped callbacks.
Its package export selects the native adapter under the `react-native` condition;
the default export is the explicit web fallback. Resource types are exported at
`effects/media`.
The image adapter uses Expo Image with no persistent cache, an identity-based
recycling key and guarded load callbacks. Supply `NativeZoom` through PhotoViewer's
`renderZoom` slot; it composes Zoom Toolkit with the shared labelled controls.
Unmount or key the screen subtree on session/scope loss. Core and UI models contain
no URL credentials, SDK object or transport. Web maps show an explicit unsupported
notice; the complete list remains available. Gallery media uses labelled synthetic
fixtures unless a real image slot is supplied, and has no production map endpoint.

The new native dependencies and config plugins change `fingerprint.json` and
require a new binary. Native load/gesture behavior, VoiceOver/TalkBack, keyboard
focus restoration and authenticated device journeys must still be verified on
that binary. Node tests, component tests and JavaScript exports are separate
source evidence; they do not establish those runtime results.

### How a rich text body reads

A `widget:richtext` field holds the Markdown the server validated and normalised
(PlatformKit decision 0069 §1), so reading it on the phone is a reading of a shape: a
blank line between blocks, a fenced block carrying its own blank lines, and a figure —
one image, its own paragraph, its title as its caption. `proseBlocks` cuts the body
into text runs and figures and never repairs one; a body holding a shape §1 could not
have stored (an image inside a sentence, a `pk-file:` that is not an identifier, a
heading outside `##`–`####`) is refused as `unsupported-format` so a screen draws the
whole body as prose rather than less of it. Those questions are asked of the body's
prose only: a fence and a code span hold what §1 stored verbatim, so a `# comment` in a
shell block, an image quoted in a fence or the `pk-file:` scheme named in a span is code
and is drawn as it was written — and a fence is ended only by a line that carries nothing
but a marker of its own character at least as wide as the one that opened it, which is how
a body can describe a fenced block, and quote three backticks in a sentence of code, without
its example turning into headings and figures. The same reading
answers `phoneEditorHolds`, which
therefore calls a fence quoting a table no table. `Prose` draws the runs in the kit's type and
the figures in the slot the media family already owns: the box is reserved from the
frame the server measured, so no paragraph moves when the bytes arrive; the byte itself is
asked for at the width this device can paint (`variantWidth`, and the bare content address
when the stored frame already fits, because no variant is ever upscaled); a figure that
did not arrive says `Image unavailable` in the reader's language and keeps every word
around it; a decorative figure is nothing to open and nothing a person listening is told
about at all, and a ready one is invited by name.
`MarkdownProse` is the only file that names a Markdown library — `src/ui/` draws what it
is handed and knows no library, no transport and no file byte. The parser behind that face
is `markdown-it@14.3.3`, held by one `overrides` entry: the face asks for `^10`, whose
`linkify-it` carries two high filings with no release inside its reach. The parser's
14.3.3 patch also fixes quadratic parsing of multiline link reference definitions
([GHSA-gfr2-rv44-r23c](https://github.com/advisories/GHSA-gfr2-rv44-r23c)).
A generated record reads its own rich text field: `derive.richBody` answers which field is
one and `RichTextBody` supplies the reading — each figure's `file/file` row for the frame
to reserve, and the bytes at the file's own content address, prepared by `fileResource`
with the key's scope — and the reader is named after the field it reads
(`field-<name>-prose`), so two bodies on one screen stay two readers. Such a field is never
the record's printed summary line (`listPreview` prints no body it cannot print without its
syntax), which is what keeps the reader on the page for an entry that hints nothing.
A body whose shape the reader refuses is drawn as the value `Value` gives it: the whole
body as text, never less of it. A figure whose file this session cannot read costs nothing
but its own picture — its row's refusal is said as `Image unavailable`, with the caption the
author wrote and the way back to ask again — and the prose around it keeps reading natively.
The row is announced by `proseSpoken` — the same body with none of the characters that only tell
a screen how to draw them — so a person hearing the record is told its sentences, a code block
as written and a figure by name, and never a `##` where a heading stands.

**Limits** — the reading of a body is here, and so is the writing of one: an
editable `widget: richtext` field offers Bold, Italic, Heading, List and Image over the box
(`RichTextToolbar`, and `src/core/richtext.ts` is the one code that edits the draft, at the
caret the box last reported, of the body the box _shows_ — marking a word of a freshly read
note marks that note rather than an empty box, and a figure whose answer arrives a second
later lands among whatever has been typed since it was asked). `Image` asks where the
picture comes from: this phone's camera, its photo library, or a file this server already
holds. A picture taken or chosen here is sent up as the multipart upload the document names
(`?image=true`, so a frame no decoder reads is refused before anything is kept) and enters
the body as the one line a figure is, pointing at the row the server answered with and never
at an address only this phone could read. A table and a task list stay the plain Markdown
box's, with the sentence naming what the phone cannot hold. The language slice is a read and
one write: every request prints the phone's own `Accept-Language`, and an answer that is written
in a language says which with `Content-Language`, kept beside the row it came with (`Api.served`)
rather than inside it; `_i18n` — the server's own note of which language a translatable field's
words arrived in, and of the field that fell back to another language's because this one has no row
yet — is said beside the field in the language the person is reading in
(`Mostrado em inglês — ainda não traduzido`); and a Save names the language back (`?lang=`) for
every translatable field it changed on a read the server answered _in_ a language — whether that
field carried a note of its own or carried none because it is that language's own text, or another
language's because the fallback is what a translator was shown in order to write it — carrying only
the fields that language owns, saying so when the sheet changed the record's own fields beside
them. A field the catalogue does not declare translatable is the record's own however the reading
was served, and the sheet writes it without the parameter rather than meeting the refusal the
server would answer it with at a language address. Where a write names no language it carries what
the person wrote and the fields the read showed as the record's own, and **not** a translatable
field nobody edited: those words came off a reading in another language, an unchanged field has
nothing new to give the record, and the sheet would rather send too little than file somebody
else's translation as the source it translates. A body's words sent with no language would be filed as
the record's own copy, over the source they were translated from, which is the write this
rule exists to refuse. The phone's own words (its buttons, its refusals, its "Image
unavailable") follow the reader's language, while a body arrives in whatever language the
server had for it and now says which one that was. Choosing the language on the phone, the
translator's side-by-side view, and the overwrite of a translation that already stands — the
kernel answers that one at the record's own translate route, which names the revision it
cuts across — stay on the web.

**Reused** — `MediaItem`, `ImageSlotProps` and the media family's
`loading | ready | error | unavailable` life cycle with its `imageUnavailable`,
`retryImage` and `open` words, unchanged; `build`, `Validation` and the existing
`unsupported-format` issue code; `Text`, `Skeleton`, `Button`, `testable`, `theme`,
`scale` and the generated token palette; `tests/fakes/presentation.ts`. **Added** —
`src/core/prose.ts`, because the phone had never read a Markdown body and nothing here
carried a width planner (which now reads the catalogue's declared widths beside the
segmentation, rather than remembering a server's width set); `src/ui/organisms/Prose.tsx`, because no Markdown reader
existed; `src/screens/MarkdownProse.tsx`, because a third-party face enters through a
screen and not through `src/ui/`. **Made reusable** — `deriveProse`'s figure view model
(`slot`, `canOpen`, `canRetry`, `openLabel`, `retryLabel`), which is what
`RecordFact` and any later prose surface will draw with no rule of their own;
`phoneEditorHolds`, the eligibility gate the editor takes before offering a body as rich
text; and the slot discipline — `renderMarkdown`/`renderFigure` in props, library and
bytes supplied by the screen — which is `PhotoViewer`'s `renderImage` pattern proven for
a Markdown face, ready for the editor's host port.

### Shared package

**Reused** — `package.json`'s identity fields, the `files` allowlist
[`tests/package.test.ts`](tests/package.test.ts) already enforces, the
manifest/lockfile equality `scripts/source.ts` refuses on every check, and the
pinned-action, read-only-permissions, checks-first skeleton of
[`ci.yml`](.gitea/workflows/ci.yml) and
[`release.yml`](.gitea/workflows/release.yml) carry this release. **Added** — a
scoped name, a version, [`CHANGELOG.md`](CHANGELOG.md) and
[`publish.yml`](.gitea/workflows/publish.yml), because this repository could not
write to a registry at all, no existing file named a version a consumer may
pin, and no YAML parser was a declared dependency of the check that has to read
one. **Made reusable** — `npm run check:publish`, the one guard a push and a
release both ask the same questions of; a changelog entry that states the
catalogue version its release renders, which that guard reads; and a workflow
whose only input is a tag, so the next version is a bump and an entry rather
than a decision again.

[package.json](package.json) exposes the existing implementation through package
subpaths: `@septagon-oss/platformkit-mobile/shell`, `renderers`, `route`, `effects/api`,
`core/catalog`, `core/derive`, `screens/<component>` and
`ui/{atoms,molecules,organisms,templates}/<component>`. Theme and scale come from
`@septagon-oss/platformkit-mobile/ui/theme` and `@septagon-oss/platformkit-mobile/ui/scale`. These exports
resolve directly to the TypeScript source used by this reference application.
The consuming Expo application supplies its routes, identity, renderer pack and
product screens, and composes one shared `Shell` and `ThemeProvider`.

`@septagon-oss/platformkit-mobile/screens/SignIn` takes an optional `title`, the product's
name over the form, and draws the shell's phases itself: a spinner while a
saved sign-in is restored, and, when a saved sign-in could not be opened, the
reason with Retry and a way to another server. A product that composes its
own sign-in screen gets the same from `SignInForm` through `title`, `booting`,
`failed` and `onRetry`; without them it renders the form as before. When the
server asks for a second factor, `signIn` answers
`{ kind: "factor-required", email }` and the same form draws the code step
through `step`, `code`, `onCodeChange`, `onSubmitCode` and `onEditCredentials`;
`answerFactor` returns that code to the server that asked for it, because that
server holds the window it spends, whatever the address field says by then.

Pass `palette` to `ThemeProvider` to use the application's complete light and
dark palettes. Pass `fonts` for native display, body and mono faces already
available on the device; load bundled fonts before rendering the provider.
An undefined face selects the system font. Omitted props use the reference
palette and platform faces. Changing either prop updates the shared components;
keep their objects stable between changes. The provider's `mode` prop still
overrides the device appearance when the product requires it.

Keep the application's design export in `testdata/design-tokens.json`. Reuse
`render` from `@septagon-oss/platformkit-mobile/tools/tokens` in its `scripts/tokens.ts`:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { render } from "@septagon-oss/platformkit-mobile/tools/tokens";

const document: unknown = JSON.parse(readFileSync("testdata/design-tokens.json", "utf8"));
writeFileSync("src/ui/tokens.ts", render(document));
```

Run that script with the application's locked `tsx` tool and `@types/node`
development dependency. Include `"types": ["node"]` in the script's TypeScript
configuration. Import `palette` from the generated `src/ui/tokens.ts` in the
composition root. Type checking
against the provider requires every shared color role in both modes. CSS font
stacks in the export are data; the application supplies their resolved native
faces through `fonts`. The generator runs during development and verification.
Native runtime code consumes its generated output; ESLint rejects imports of
the build tool or Node APIs into runtime layers.

The application owns its native dependencies and lockfile. Declare the native
packages directly in that application at the versions used here so autolinking
finds them and React, the router and their contexts have one installed instance.
Pin the shared package to one published version, with no range:

```json
"@septagon-oss/platformkit-mobile": "0.2.0"
```

and name the registry that holds it in that application's own `.npmrc`, in the
shape the forge documents for a scoped package. Which host the forge is belongs
to the deployment, so this repository commits no registry address:

```ini
@septagon-oss:registry=https://<forge host>/api/packages/septagon-oss/npm/
//<forge host>/api/packages/septagon-oss/npm/:_authToken=<read token>
```

Commit the resulting application lockfile, including the resolved URL and
integrity hash; branch archives and local checkout paths do not identify a
fixed dependency. Anonymous reads of the package scope are refused today, which
is why the consumer's own line carries a token.

An HTTPS source archive whose URL names a full published commit ID still
installs, and is now the way to pin a commit from before this rename: an archive
of this commit or later carries the scoped name above, and an older one answers
only the unscoped `platformkit-mobile/...` spelling.

The kit is published from the tag `kit-v<version>`, which has to name the
version in `package.json`.
[`publish.yml`](.gitea/workflows/publish.yml) runs `npm run check` first, then
the same guard with the tag it was cut from
(`node --import tsx scripts/publish.ts --check --tag <tag>`), then the one write
— the kit to this
forge's npm registry, authenticated by the repository secret
`NPM_PUBLISH_TOKEN`. Until that secret exists every run refuses on the step that
reads it and nothing reaches the registry. Before the write, that step asks the
registry — with the same credential the write carries, because an anonymous read
of this scope is refused and so answers nothing — whether it holds the version.
A version the registry already holds is never written again: the fix for that
refusal is a new version and a new tag. Any other answer, including no answer,
refuses the run as well, because a publish may not rest on a question the run
could not read the answer to. Only released versions are published: a prerelease
is refused by `npm run check:publish`, because npm sends one under a dist-tag
this release does not name.
The `v*` namespace stays `release.yml`'s — it builds binaries and publishes no
package, and Gitea anchors a ref glob, so neither tag namespace reaches the
other's runs. [CHANGELOG.md](CHANGELOG.md) carries one section per version and
states the catalogue version that release renders; `npm run check:publish`
refuses a manifest version with no section here, or a section that names another
catalogue version, so an entry cannot be skipped by the commit that bumps it.

For local review, `npm pack --ignore-scripts --pack-destination /tmp` creates a
source dependency archive. Its contents are `src/`, `scripts/tokens.ts`, the
shared `scripts/android/` recipe, `CHANGELOG.md`, `NOTICE`, `LICENSE` and npm's
package metadata and documentation.
It contains the shared implementation, including generated design tokens. The
reference application's routes, Docker setup and test tooling belong to the
complete application handoff below. `npm run check` packs the dependency
in a removed temporary directory, verifies public imports from the extracted
package and checks that its relative source dependencies are present. Consumer
type checking, bundling and device journeys remain separate verification steps.

### Build a consuming Android application

The exported `@septagon-oss/platformkit-mobile/tools/android` entry is the same Bash recipe
used by this repository. After installing the consuming app's locked
dependencies, run this from that app's root in the Android build environment:

```sh
bash "$(node -p "require.resolve('@septagon-oss/platformkit-mobile/tools/android')")" "$PWD"
```

The target needs `package.json`, `package-lock.json` and an Expo app
configuration. The recipe runs that app's installed Expo CLI and uses Gradle
settings and signing rules from this versioned dependency. It never copies the
reference app's routes or identity. The optional application argument defaults
to the reference app when running its own `scripts/android/build.sh`.

This command regenerates the target's `android/` with `expo prebuild --clean`,
then builds the Gradle tasks selected by `TARGETS`. Keep native configuration in
the app config and config plugins. Build a source export outside the development
checkout to leave that checkout's generated native files untouched.
The SDK, JDK, native npm dependencies and Gradle downloads are still build
prerequisites; the pinned image under [Build a binary](#build-a-binary) supplies
the toolchain. `ABIS`, `PK_PROFILE`, `PK_VERSION` and signing variables retain
the meanings documented below, with app identity resolved by the target's own
configuration. Outputs stay under the target's
`android/app/build/outputs/`. A successful build still needs device verification.

## Hand off source

The application owner commits its identity in `app.config.ts`, its screens
through the renderer pack in `app/_layout.tsx`, and its design export in
`testdata/design-tokens.json`. Keep native dependencies in this application's
`package.json` and lockfile. Custom screens use `src/screens/`, domain decisions
use `src/core/`, HTTP uses `src/effects/`, and presentation composes the existing
atomic layers in `src/ui/`. A branded shell still needs its product workflows
and device verification before it is a complete application.

After `npm run check` passes, commit the application and export its full commit
ID. Run this from the repository root; the destination's parent must exist and
the destination must be new and outside the workspace:

```sh
git rev-parse HEAD
npm run source -- --revision <full-commit-id> --output /tmp/mobile-source
```

[scripts/source.ts](scripts/source.ts) reads the committed files, preserving
their executable modes. It includes routes, source, assets, tests, the lockfile,
native fingerprint and build recipe. Hosting workflows are excluded. Local
dependencies, workspace links, symlinks and tracked local configuration cause
an error; working-tree edits, ignored files and installed dependencies are
never copied. `npm run check:source`, part of `npm run check`, applies the
same manifest and lockfile rules to the working tree without exporting, so a
local dependency or an unpinned package is refused on every check rather than
at the handoff. `SOURCE.json` records the source revision and each delivered
file's SHA-256, byte count and mode. It proves provenance, not publication or
runtime behavior. Verify that revision is published before distributing a
release, and retain the receipt when you archive the exported directory.

From the exported directory, install and verify without the original checkout:

```sh
npm ci
npm run check
npm run export:check
```

Installation downloads the locked npm packages; native builds also need the
platform toolchain and its dependencies. The export is source, not an offline
dependency cache or a backend server. Both bundle exports must compile; use
the [binary recipe below](#build-a-binary) and the device flows to verify the
application's actual journeys. A recipient can edit the exported files directly.
When importing into its own repository, retain the received receipt as
`UPSTREAM.json` before committing: `SOURCE.json` is reserved for the next export.

## Build a binary

The Android build is one recipe, `scripts/android/build.sh`, run inside the
pinned build image by `Dockerfile.android`, so neither a runner nor a
developer machine needs the SDK:

```sh
make apk                          # unsigned arm64 release APK in out/
make apk ABIS=x86_64 PROFILE=ci   # the verification build an emulator runs
make aab                          # unsigned AAB and universal APK, all ABIs
make apk-mirror                   # the same recipe under the CI runner's 2 CPU / 4 GiB
```

`app.config.ts` decides the identity: `PK_VERSION=v0.2.0` gives version
0.2.0 and a version code that only grows; `PK_PROFILE=ci` builds
`PlatformKit CI` under its own package, with the gallery route, so it can sit
beside a real install. Release builds are unsigned by the recipe
(`scripts/android/signing.gradle`); `make apk-debug-sign` signs one with the
SDK's debug key for an emulator, and `make sign` signs the release outputs
with a keystore named by `PK_KEYSTORE` and its three companions, verifies the
certificates and writes `SHA256SUMS`. The key never leaves the machine that
holds it. iOS is built on a Mac with `npx expo prebuild --platform ios` and
`npx expo run:ios --configuration Release`; there is no iOS build in CI.

The `android` workflow builds the verification APK whenever a native input
changed (the fingerprint, the configuration, the lockfile, the recipe) and
keeps it as a run artifact for two weeks. It needs a verification environment
with about 6 GiB of memory: one architecture, built serially with the settings
in `scripts/android/`, peaks at 4.1 GiB by itself, and a job shares its
allowance with the builder, which is where 4 GiB failed. At 6 GiB a cold job
builds in about seven and a half minutes. The job runs only when the
repository variable `ANDROID_BUILD` is `on`, so an environment without the
memory reports nothing rather than failing; `make apk` builds the same thing
locally either way.

## Verify a change

The repository CI runs `npm run check` on pull requests and main pushes.
`npm run check` runs twelve gates in order, and stops at the first that fails:
`check:api` (offline generated source comparison),
`check:sdk` (`EXPO_OFFLINE=1 expo install --check`: every installed native
package against the ranges the pinned `expo` bundles, read from
`node_modules/expo/bundledNativeModules.json`), `typecheck` (TypeScript),
`lint` (ESLint, including the layer
rules), `format:check` (Prettier), `test` (the Node suite, `node --import
tsx --test tests/*.test.ts`, then the Jest suite, every `tests/**/*.test.tsx` rendering
components, the shell, the route dispatcher and the screen hooks),
`check:fingerprint`, `check:flows` (the journeys counted are the ones
`maestro test e2e/flows` takes — either YAML spelling, in that directory itself,
the workspace's own `config.yaml` aside: Maestro's planner keeps what the
workspace's `flows:` glob matches and its default is `*`, a name and not a path,
so the gate refuses a folder that holds a journey rather than count coverage no
run makes. The configuration narrows the count only as far as it narrows the
run: a journey `flows:` leaves out covers nothing, a selection is read in every
spelling that planner reads it (a quoted key, a space before the colon, a
leading byte-order mark) and the last `flows:` key is the one that wins — its
empty value included, because `flows:` with nothing after it, or that same value
spelled `~` or `null`, plans the whole directory and takes the run back from a
selection written above it — and one
written any other way — a flow mapping, a scalar where a list belongs, a list
with an item left empty, unclosed or tab-indented, a filter pointing at no file
beside it, a `tags:` read out of each flow's own header, an `excludeFlows:` no
Maestro run applies at all — is refused by name rather than read as agreement;
every id one of them names is a testID a component sets, every route screen under
`app/` is named by some flow's `# screen:` header, every flow names the screen it
proves, and every text selector is spelled as the regex source Maestro compiles it —
between slashes the delimiters are two characters the element's own text would have to
carry, so such a journey taps nothing and is refused where the words are written),
`check:inventory` (the suite's own record in `tests/inventory.json` answers for this
checkout: a reached test file with no row, a row whose file is gone, a row whose
layer, tier, reach or rule the file no longer answers to, or a rise in the count of
review-named files or of files no runner reaches — see _Which tests run where_
below), `check:publish` (the manifest names a package the registry can hold and the
changelog carries the entry this version's release is documented by) and
`check:source` (the manifest and lockfile install from the
registry alone) and `check:parity` (every file under `tests/parity` hashes to the byte the kernel commit
named in its `parity.source.json` wrote, and each fixture's own two hashes are the ones its `input` and
`expected` members compute to under the kernel's canonical-JSON rule — see _The server's resolved policy_).
[fingerprint.json](fingerprint.json) is the hash of everything
a binary is built from: the app configuration, the native modules in the
lockfile and their config plugins, the Android recipe, the bundler
configuration and the design export. When a change moves it, run
`npm run fingerprint` and say why in the commit, because that change needs a
new binary. CI also exports both bundles, refuses a dependency advisory no
review covers (see below), scans the history for secrets (one value is exempt,
by its shape alone: the synthetic publish credential the release tests hand a
fake npmrc, named in [.gitleaks.toml](.gitleaks.toml)), runs the device
journeys against a pinned kernel image, and a weekly workflow reports what
drifted without blocking anything. A nightly one blocks: [kernel-main.yml](.gitea/workflows/kernel-main.yml)
reads kernel main and fails when this build cannot read it, which is the part no
pin covers — see below. Node is pinned once, in
[.nvmrc](.nvmrc).
Use `expo install` for native dependencies so they match that SDK. The app owns
the native font, module core, Reanimated and Worklets dependencies used by its
router and tests; their SDK-compatible versions must resolve once at the app
root. Commit the lockfile with every dependency change.

The SDK gate is deliberately offline. `expo install --check` otherwise asks
Expo's live version service, so a patch published upstream turns an unchanged
commit red: that happened twice in one week and is somebody else's release, not
a defect here. With `EXPO_OFFLINE=1` the same command compares the installed
packages against `bundledNativeModules.json` inside the pinned `expo`, a file
`npm ci` reproduces byte for byte, so the gate answers the same for a given
tree on any machine and any day. It still refuses a package that does not match
the pinned SDK, which is what it is for. Only `expo` itself is outside that
manifest, because it is the pin everything else is compared against.

The advisory gate is deliberately reviewed rather than live, for the same reason.
`npm audit` answers "what does the advisory database say about this tree today?",
and that answer moves when somebody else publishes or files: three
denial-of-service filings were made against a version of `brace-expansion` that
no commit of ours had chosen, and turned CI red on a change that touched no
dependency. The database has also covered a package in full — every published
release of `node-forge`, which the Expo CLI depends on and upstream has not
released a fix for — so the alternative below was a permanently red check until
somebody switched it off, which is how a check dies. `npm run check:advisories`
keeps `npm audit` as its input and compares it against
[advisories.json](advisories.json): a high filing is refused unless a review
names that GHSA, the versions this lockfile actually holds and a date that has
not passed; a critical filing is never exempted; and a review whose filing is no
longer reported, whose versions moved, or whose date has passed is itself a
refusal, so the record cannot quietly become an ignore list. Take the fixed
version whenever one exists — the record is for what has no version to move to.

```sh
npm run check:advisories    # the gate CI runs: needs the registry, like npm audit
npm audit                   # what the database says, reviewed or not
make test                   # the advisory rules themselves are tested offline
```

What the database says with nothing compared against it — and what a review will
expire against — is in the weekly `drift` report beside the SDK's opinion.

Asking what Expo now recommends is an owner's action, not a gate:

```sh
npm run sdk:latest          # the online check: what upstream would change
npx expo install --fix      # take it, then commit package.json and the lockfile
npm run fingerprint         # a native pin moved, so the binary identity moves
```

Do that deliberately, in its own commit, and say in the commit why the native
project changed. The weekly `drift` workflow runs the online check too and
reports what it finds without blocking anything.

Starting Expo generates route types under the ignored `.expo/` directory,
which TypeScript also checks.
The individual commands are in [package.json](package.json).
`npm run format` formats TypeScript in `app/`, `src/` and `tests/`.
`make test` runs the two suites and nothing else — `node --import tsx --test
tests/*.test.ts` then Jest — under the name a person or a CI step asks for the tests by, and it
installs from the lockfile first when the checkout has no `node_modules/`. It
replaces no gate: `npm run check` stays the required check.

The Node tests cover catalog parsing, screen derivation, the token
generator and its provenance, the distance guard, out-of-order lifecycle
events, interrupted storage writes, HTTP behavior with supplied effects and the
source gates. The Jest tests (`npm run test:ui`, the Expo preset and React
Native Testing Library) render the atoms, molecules and organisms with sample
props and assert what a screen reader would find (`tests/ui/`), drive the
shell over an in-memory secure store and a fake fetch (`tests/shell.test.tsx`),
the route dispatcher over a mocked router (`tests/route.test.tsx`) and the
screen hooks over a fake Api (`tests/screens/`). Neither suite launches Expo,
exercises a native device or connects to a live server. For a screen or session
change, also exercise the affected journey on the target platform and report
what you ran.

### Which tests run where

Four layers, one tier each (decision 0088). `tests/INVENTORY.md` and
`tests/inventory.json` record every test file — its layer, what it costs, how many
recent runs of `main` named it as a failure, the production lines nothing else
covers, the rule it proves and the verdict proposed for it — and
`npm run check:inventory`, the ninth gate of `npm run check`, re-reads the shape of
every row from the checkout: a reached file with no row, a row whose file is gone, a
row whose layer, tier, reach or rule the file no longer answers to, a `merge` or
`delete` verdict with no successor named and no assertion mapped forward, or a rise in
the count of review-named files or of files no runner reaches. It never decides
whether a file runs — that is its runner's glob alone — so a wrong row cannot silence
a test. The verdicts are a proposal: root ratifies the table before any prune commit,
and no prune lands in this change. The layer is read from what a file **imports**, so
a test that drives a tool by spawning it (`scripts/tiers.ts` under `tsx`, say) is
filed by its own imports — behaviour — whatever its subject is; a row that means
otherwise carries a `layerReason` and the gate takes the override.

The tiers build on that table and add work rather than replacing it.
`npm run test:contracts` is the contract tier — one process each for the pinned
documents, the generated client, the published surface, the flows and the inventory.
`npm run test:scope -- <base> --run` is the push tier's scope: the test files whose
transitive imports reach a file the diff touches, computed from the suites' own import
statements. It names any changed `src/` or `app/` file no suite imports at all and
exits zero for it: every route under `app/` is in that set, because a suite mounts a
screen through `tests/fakes/router` and a flow claims the route itself, so a scope
that refused would turn away an ordinary change to the home screen before the required
check had read it. A name belongs to the scope; a refusal belongs to `npm run check`.
`npm run test:merge` is `npm run check` under the other tier's name, and it is what
every push and every pull request still runs whole. `.gitea/workflows/nightly.yml`
runs `npm run report:tests`, which publishes the slowest files, the slowest tests and
the flaky rows as one JSON artefact read out of the inventory. A scoped run is never
the only evidence a change gets: the selected subset is a faster first answer, and the
full suite is the merge gate.

**Reused** — `scripts/check_flows.ts` (its `--list`/refusals-as-strings CLI shape,
which `scripts/inventory.ts` copies), `tests/component-suite-gate.test.ts` (the
runner-discovery pins the tiers work around rather than replace),
`tests/test-name-grammar.test.ts` (whose 0072 count the inventory keeps as a
ratchet), `CLEANUP.md`'s per-folder coverage table as the shape of a baseline,
`advisories.json` + `scripts/advisories.ts` (schema-first, unknown keys refused,
entered as its own `check:*` step) as the shape of the inventory artifact, and
`scripts/e2e/{run.sh,mobile_ci.sh}` with `e2e/flows` as the journey harness.
**Added** — `scripts/inventory.ts`, because nothing in this repository named a test's
layer, cost or reach, and the columns cannot be derived from a coverage report alone;
`scripts/tiers.ts`, because 0088's push tier asks which tests a diff reaches and the
inventory's `loaded` column is a count of one run, not a reverse index; the tier
steps in `.gitea/workflows/ci.yml` and the nightly report job, because one tier ran
everything today; and `tests/INVENTORY.md`, `tests/inventory.json` and
`tests/duplicate-candidates.md`, which are the table root ratifies.
**Made reusable** — the inventory's row shape and its `--sync`/`--measure` commands,
so the next task that adds a test adds a row in the same commit and CI refuses the
one that does not; `--measure` runs the file's own runner — node or jest — so a
component suite costs one command rather than a hand-typed case list; `reachedBy` as a diff-to-tests lookup any later gate can call
instead of re-deriving one; `baseline.unreachable`, which turns "this file runs
nowhere" from a sentence in a report into a refusal; and `e2e/flows/session-restored.yaml`
as the pattern for a journey whose assertions are only testIDs and words the screen it
names actually draws (the sign-out journeys assert the `Sign out` label, which is
`src/screens/Home.tsx`'s own literal rather than a word of `src/core/copy.ts`), and the
shape of a `keep` reason — what only that row proves, the sibling that comes closest, which
run its numbers came from, and no coverage claim a column left null cannot support. The
reason's emptiness is refused by `checkInventory`; what it points at is read by
`tests/a-keep-reason-names-siblings-the-table-holds.test.ts`, which refuses a named sibling
that is no row of the table and a measured row still saying it is new.

### Run the device journeys

A flow is a journey a person takes on a device: `e2e/flows/` holds one per
screen this app draws, and `make e2e-android` runs them on an emulator against a
server you already have. It needs the verification build signed for an emulator
(`make apk ABIS=x86_64 PROFILE=ci && make apk-debug-sign`), a device on `adb`,
the Maestro CLI, and the values the flows read, which `scripts/e2e/run.sh`
names: `SERVER`, `EMAIL`, `PASSWORD`, a writable resource `MODULE`/`ENTITY`
whose first writable string field is `KNOWN`, a lifecycle command `VERB` with
its argument `VERB_FIELD` and the summary the API document gives it
`VERB_TITLE`, and optionally `TITLE` (a per-run stamp by default). Nothing is
committed, no flow names a tenant, and no journey runs against a mocked API.
`sign-in-factor.yaml` reads three more — `TOTP_EMAIL`, `TOTP_PASSWORD` and
`FACTOR_CODE` — for the account that answers with a second factor:
`scripts/e2e/mobile_ci.sh` creates that person on the served kernel (the
administrator stays password-only, so no other journey gains a step), enrols a
factor over HTTP with `scripts/e2e/totp.py` printing the code for the current
step, proves the challenge leg there while the code is fresh, and exports one of
the account's recovery codes for the journey to spend, because Maestro starts
once for every flow and a time-based code is right for thirty seconds.
Both runners end at `scripts/e2e/run.sh` — the workstation's
`scripts/e2e/android.sh` and the CI job's `scripts/e2e/mobile_ci.sh` — so
neither keeps a flow list of its own: the spec list is the directory, and
`check:flows` is what makes that honest. That gate proves what is provable
without Maestro, and `check:flows -- --list` answers with the same set, which is
what the job walks for `maestro check-syntax <file>` — it takes one flow, not the
directory — so gate, job and runner name one set of journeys. `ANDROID_SERIAL`
names the device to adb, and `scripts/e2e/run.sh` names it to Maestro too
(`--device`): Maestro reads no `ANDROID_SERIAL` and falls back to every device it
finds connected, so a second emulator would otherwise install on one device and
run the journeys on another. A flow says which screens it proves with
`# screen:` lines in its header comment, above the `---` that starts its steps;
a line like that among the steps is a remark about one step and covers nothing.

The verb journey is the one that reads two ways. At the record's address
(`app/[module]/[entity]/[id]/run/[verb].tsx`) it runs a lifecycle command to its
end: the sheet, its argument, `run`, and the field the command wrote in the
record afterward. At the collection's address
(`app/[module]/[entity]/run/[verb].tsx`) it proves the refusal: a command says
whether it is about one record or about the list, the reference kernel composes
no command about a collection, so the screen owes that address a named refusal
and not a sheet a person could fill in and run at a path the server never
mounted.

The `mobile-e2e` workflow runs every flow on each push to main and nightly,
against a kernel it serves itself, and carries no `continue-on-error`: a journey
that skipped would leave the coverage the gate above counts looking like a
figure nobody earned. It runs on `pkit-ci-android`, the label whose image carries
the Android SDK, an AVD, Maestro and `/dev/kvm`; the plain Linux host it used to
ask for answered its probe with `missing: adb emulator maestro psql keytool` on
every run of main, which is a probe refusing correctly rather than a journey
failing, and the label is a rule a test holds from here. It needs one repository
variable — `PK_MOBILE_AVD`, the Android Virtual Device to boot, refused by name
when it is missing — and one read-only secret, `PK_KERNEL_TOKEN`, the same one
[kernel-main.yml](.gitea/workflows/kernel-main.yml) reads the kernel with: this
forge requires sign-in to read `septagon-oss/platformkit` and a job token is
nobody on a repository it was not issued for, so a checkout of the kernel that
carried no token of its own is a step no run gets past; where the secret is unset
the checkout falls back to the job token, so the refusal is the forge's own — a
checkout that failed, naming the repository — and not an empty input. Which
kernel to serve is not a variable:
the job checks out the commit [testdata/catalog.source.json](testdata/catalog.source.json)
and [testdata/openapi.source.json](testdata/openapi.source.json) already record
as `upstream.commit` — at that object id, never a branch — and builds it with the
Go version that build's own `go.mod` asks for, so the server the flows write
through is the server the fixtures describe. That pair is read in one place,
`scripts/e2e/mobile_ci.sh --kernel-pin`: it refuses naming the record that is
missing or holds a commit shorter than forty hex characters, and names both
records when they name different builds, because then the fixtures are not one
build's. The step that runs it ends the job on that refusal — the commit is
assigned in a statement of its own, not substituted inside the `echo` that
publishes it — because an empty step output is a ref the checkout fills with the
kernel's default branch, which is the one build this journey must never serve.
Its own database, tenant, administrator and password are created by the run and
dropped with it, and the Maestro report is printed in the job log. The wait for
`/health` has a bound, and a kernel that stays alive and answers nothing ends the
run naming the port, the commit it was built from and its own log — a journey run
against no server would report thirteen timeouts and say nothing about the server
that never bound. The device is
host-level, so the job's concurrency group is named for the device and not the
ref, and the step that boots the emulator refuses a host that already has a
device attached — in any state adb lists it, because an `offline` entry is
another job's emulator mid-boot, and adb answers for it — then asks every
question of adb with the one serial whose console port it claimed, and publishes
that serial only while it is the sole device the host has: a launch that failed
cannot then be read as a device somebody else booted. A workflow file cannot
hold a machine against a job that is not its own, so it declines the machine
instead of sharing one. What a checkout cannot see is whether this forge fires
`schedule:`, or whether that label answers `actions/setup-node`,
`actions/setup-go`, a `services:` block and a checkout of another repository —
the first run is what will tell, and
until then no journey here has been shown passing on a device. What that job
proves is these journeys; the kernel's `mobile_flow_pass_rate` is read from the
kernel's own manifest, and stays where that manifest puts it until a kernel-side
change reads this repository's report.

A journey that fails says what the device saw. The step after the journeys runs
`scripts/e2e/device_logs.sh`, which asks the emulator — still alive, still this
job's own serial — for its crash buffer, its `am_crash`/`am_anr`/`am_proc_died`
events and the app's own React Native lines, each read bounded twice: by the `-t`
the device itself honours, and by the deadline `PK_MOBILE_READ_TIMEOUT` sets (one
minute by default), which ends a call to a device whose adbd has wedged so that a
run stuck on one unreadable buffer still reaches the artifact step and the
emulator teardown. That is the difference between three owners of a fix: a
`FATAL EXCEPTION` in the crash buffer is the app's, a JavaScript error that
resolved no module before the first frame is the app's at another line, and a
device that answers nothing is the runner's — and a flow that timed out at
`id: home is visible` names none of them. The script exits 0 whichever read
failed, because a diagnostics step that failed would report itself instead of the
journey, which is the harm `continue-on-error` does and which this job refuses.
What the run keeps is one artifact: `e2e/out/` and `emulator.log`, for the week
its run is readable. In it are Maestro's per-flow debug bundle — its screenshots
and view hierarchies, the only capture of the step that failed, since a screencap
taken now photographs the last flow's screen — the device's log lines, the JUnit
report, and the served kernel's own log, which `scripts/e2e/mobile_ci.sh` copies
out of the work directory its trap deletes. The job's log prints that log too
wherever the server failed to serve; the copy is what outlives the run, the log's
truncation and the database it names. Maestro's bundle can hold what a journey typed, so
those files stay in the artifact and never in the job log: every such value is
generated for one run and dies with its database. Both directories are named once,
in the job's `env:` as `PK_MOBILE_DEBUG_DIR` and `PK_MOBILE_DIAGNOSTICS`, and
defaulted to those same strings by the two scripts that also run without a job —
the convention `PK_MOBILE_REPORT` already holds, and the reason an artifact can
never publish a directory nothing wrote to. A file missing from the artifact is a
warning and not a refusal: a run that died before Maestro wrote anything is
already refused twice over, and a third refusal naming no file would replace the
cause with a complaint about the evidence.

**Reused** — the four journeys that already existed (`sign-in.yaml` as a
sub-flow every new one opens with, `gallery.yaml`'s deep-link and scroll
vocabulary, `record.yaml`'s create-edit-delete spine), the testIDs and header
words the components already set, `scripts/source.ts`'s exported-check-plus
module-run-guard shape for `scripts/check_flows.ts`, `tests/scale.test.ts`'s
guard-with-its-own-fixtures shape for `tests/flow-coverage.test.ts`, and —
copied and cited in each file's header — the kernel's `scripts/mobile_e2e.sh`
serve-and-wait fixture, its `.gitea/workflows/mobile.yml` step list, its
`postgres-init.sql` role, and the tool search and refusal of its
`e2e/maestro/README.md`; and, for the run that serves the kernel, that job's
`pkit-ci-android` label and its `actions/setup-go` pin, and the `upstream.commit`
the two provenance records already held; and, for the run that explains itself,
that job's own serial from the boot step's output, the `if: always()` report step
as the neighbour a new step is placed beside, `android.yml`'s
`actions/upload-artifact` pin at the object this repository already runs, and
`PK_MOBILE_REPORT`'s name-once-and-default-it convention. **Added** —
`scripts/e2e/mobile_ci.sh`,
because nothing in this repository has ever started a server (`android.sh`
required one somebody else had started) and no existing unit could state the
claim that a device which signed in can use what the served catalog published;
and `.gitea/workflows/mobile-e2e.yml`, because no workflow named a flow at all;
and `scripts/e2e/device_logs.sh`, because asking a device for its own log is a
thing no unit here or in the pinned kernel has ever done.
**Made reusable** — `scripts/e2e/run.sh`, one last mile (install, reverse, run
the directory, write the JUnit, and now Maestro's debug bundle in a directory the
job names) that any future runner calls instead of
repeating, `scripts/e2e/tools.sh`, the tool search and the refusal that says
where it looked, `scripts/e2e/mobile_ci.sh --kernel-pin`, which answers the one
question "which kernel commit do these fixtures describe" for anything that has
to serve that build or fetch it, one directory (`e2e/out/`) that is what a run's
evidence means and what the artifact publishes, and `# screen:` as the way a journey says what
it proves — so
the next screen added under `app/` arrives with a journey or with a failing
check.

[testdata/catalog.json](testdata/catalog.json) is a checked-in copy of
PlatformKit's `ui/screens/testdata/catalog.json`, and
[testdata/catalog.source.json](testdata/catalog.source.json) records the commit it
was copied from, in the same shape the design-token provenance uses. The suite
checks the bytes against that record offline, so editing the copy to make a test
pass fails instead of fixing anything. `node --import tsx scripts/catalog.ts refresh` rewrites
both files; the pin itself moves only by editing the recorded commit, which is a
diff somebody reviews. What no local check can see is whether the server has moved.
`node --import tsx scripts/catalog.ts drift` asks the recorded commit and the
public module proxy and reports without blocking, and no schedule runs even that:
the weekly [drift workflow](.gitea/workflows/drift.yml) reports what the
SDK, the dependency tree, the advisory database and the fingerprint say today,
and holds no catalogue step. The nightly
[kernel-main workflow](.gitea/workflows/kernel-main.yml) asks a different question
and does not run this command — `drift` answers "has the commit this file recorded
moved?", `kernel-main` answers "can a build cut today read the server in main?"
against kernel main's own bytes, and refuses. See below for the second question.
A proxy it cannot reach is reported as _unknown_ and never as agreement: the first version of
`scripts/catalog.ts` asked the proxy for `septagon-oss/platformkit` instead of
`github.com/septagon-oss/platformkit`, took a 404, and printed "ok, this is the latest
version". A proxy that answers nothing at all is asked again — three attempts, because
a connect that times out after the transport's ten seconds is a moment on a busy host
rather than a fact about the module, and "we could not ask" is a claim worth spending
two attempts on. A status that answers about the path is asked once, so the retry
cannot be a second way of missing the 404 above.

Unlike the design tokens, this fixture is a test input and not a build input — no app
code reads it, and `scripts/fingerprint.ts` names its sources rather than sweeping
`testdata/`, so refreshing the copy is not a binary change and the `android`
workflow has nothing to rebuild. A stale copy blinds the suite and the review; it
cannot reach the person. What can reach them is a server answering with a shape this
build has never seen, so `parseCatalog` refuses a `catalogVersion` newer than
`SUPPORTED_CATALOG_VERSION` in [src/core/catalog.ts](src/core/catalog.ts) rather than
drawing a screen from the fields it happens to recognise; a server old enough not to
stamp is the server this shell was built against, and is accepted.

The stamp this build answers to is 2, which is `ui/screens.CatalogVersion` on
kernel main, and version 2 says three things version 1 did not. `write_path` is
where a resource's writes are answered when they are not answered at its read
address — a control plane whose rows read from the tenant host and are written on
the ops one. `operations` names the verbs the server actually mounted for the
resource, and a command's `path` is its whole endpoint, `{id}` and the verb
already in it. One function owns each derivation: `writePath` and `commandPath`
in [src/core/derive.ts](src/core/derive.ts). The transport builds no write
address of its own — a list, a read and a singleton read go to `path`; a POST,
PATCH, PUT and DELETE to `writePath`, which is `path` unless the document printed
another; and a command to the address it printed, with the row substituted and
the verb never appended a second time. Which doors a screen draws is one rule
too: `doors(entry)` is `writable` — this caller may write — times `operations` —
this verb is mounted — and it is what the three generated screens draw. The three
hooks that send a write recheck the verb half of that rule, `offers(entry, verb)`,
because a sheet arrives by a link or a restored stack as easily as by the button;
what `writable` says is not rechecked there, exactly as before version 2, and the
server is what refuses a write from a caller who may not perform one. An absent or
empty `operations` means all five, exactly as in version 1, so a server that says
nothing keeps every door it always had. `operations` narrows the write doors only:
no screen consults it for `list` or `read`, so an entry naming `["create"]` and
nothing else would still be given a list and a detail whose GETs nothing answers —
the shape no kernel resource is today, since a resource with no read is nowhere the
phone can go.

The pinned copy carries none of those three keys — no resource in the kernel's
golden has its writes elsewhere — so
[testdata/catalog.control-plane.json](testdata/catalog.control-plane.json) sits
beside it: the copy's three resources, then a resource written on another
surface, a command at a printed address of its own, and a singleton whose PUT
follows it. The copy is not extended in place, because the hash that makes it
trustworthy is a hash of the kernel's bytes; a test asserts the extension is
those bytes plus those entries instead. The generated catalog types retain `screen` and `present` as metadata. Neither
changes a native route or draws a new control. `display`, `maxLength`, `translatable` and
`keys` are declared by the document and carried by the field view with no screen of their
own — a test distinguishes retained metadata from rendered behavior, and only a stray JSON
member outside the document is refused. The `richtext` widget is read natively and written
with the marks that reader draws back, a picture taken here included (under
_How a rich text body reads_ above).

**Reused** — `parseCatalog`'s supported-version and path checks, `CatalogError`, and
the `writable` gate the screens already consulted; the New, Edit, Delete and Save
buttons, their copy and their testIDs; `createApi`'s `call`/`json` and its `/api/v1/`
guard; `scripts/catalog.ts`'s `provenance`, `check` and `refresh` with the
`platformkit.catalog-source.v1` record unchanged; `fakeFetch` and the fakes in
`tests/fakes/`. **Added** — `writePath`, `operations` and a command's `path` on the
parsed entry, one `absolute()` rule shared by every address the document prints, the
verb set `offers`/`doors`, the two derivations, and the extension fixture — nothing
existing carried an address that is not the read path, and the extension is a second
file because widening the pinned copy would break the very hash that vouches for it.
**Made reusable** — one named owner per address, so a renderer pack or the next
screen asks `writePath`/`commandPath` instead of joining `entry.path` by hand; the
rule that every address the document prints is an absolute path, refused at its own
field — named as a rule rather than a symbol, because the function that holds it is
private to [src/core/catalog.ts](src/core/catalog.ts), and because it is the
half a document can be refused for: what makes a path sendable at all (under
`/api/v1/`, no fragment, fully encoded) is one rule owned by `createApi`, so a
document printing `/elsewhere` stops at send time, not at the parser — and this is
what the generated types (T-0287) will have to answer to; and
`testdata/catalog.control-plane.json` is the fixture any later control-plane work —
and the next control-plane refusal — runs against.

Kernel main is a different question from a pin, and
[kernel-main.yml](.gitea/workflows/kernel-main.yml) asks it every night and on
dispatch: the job runs `npm run check:kernel-main`, which is
[scripts/kernel_main.ts](scripts/kernel_main.ts) — three GETs with the job's own
token: the kernel's branch tip first, then `ui/screens/testdata/catalog.json` and
`apps/platformkit/testdata/openapi.json` at that one object id — never at
`ref=main`, so a commit landing mid-run cannot mix two readings. The two pinned
journeys answer "does this build work against the build we named", which is a
question a pin can only answer by freezing one side so the other cannot move; this
answers "can the build in main read the server in main", and catalogue version 2
is the price of never having asked it — the server moved the document shape on
2026-10-01 and every phone built from main went on passing (T-0285). Nothing there
continues on error: a nightly that printed a refusal as a note would be the drift
report with a cron. A nightly's verdict is the exit status its step returns, so
`tests/kernel-main.test.ts` runs that step as a child process against a forge on
loopback and pins both codes — 0 with the agreement last, 1 with the refusal on
stderr and the kernel commit on stdout, and the token on neither stream. The read
carries its own bound, two minutes by default and `PK_KERNEL_TIMEOUT_MS` to move it,
because a job that hangs answers neither red nor green: the bound arrives as a
refusal naming the URL, the budget and the commit already learned, where the job's
`timeout-minutes: 20` would only have stopped a silent process. A red names the
kernel commit, the sha256 and byte count of both documents, and the first refused
path — the commit and the digest together re-fetch exactly the bytes that
were refused, so the job log is the whole post-mortem and the run itself stores
nothing. It is not part of `npm run check`, which is a decision rather than an
omission: `check` runs on every change with no token and sometimes no network, so
a gate that needs a credential would refuse every change for a reason that is not
the change. By hand, with a token that can read the kernel repository:

```sh
PK_KERNEL_SERVER=https://forge.example PK_KERNEL_REPOSITORY=septagon-oss/platformkit \
  GITHUB_TOKEN=$token npm run --silent check:kernel-main
```

**Reused** — `parseCatalog` and the `Catalog` type from
[src/core/catalog.ts](src/core/catalog.ts), imported and not wrapped, and
`CatalogError`'s own sentence printed verbatim rather than re-formatted, so the
line a red night prints is the runtime's and the nightly gains every rule the
parser gains (`SUPPORTED_CATALOG_VERSION` is imported where a refused document
is _built_ — the test raises the stamp from it instead of writing the number, and
the script never needs it because the parser is what consults it); `hash` and
`isRecord` from
[scripts/catalog.ts](scripts/catalog.ts), which had both and exported one; that
file's exported-pure-plus-thin-`main`-behind-a-module-run-guard shape; the
`fakeFetch` shape of `tests/api.test.ts`, copied rather than shared because this
port answers `text/plain` bytes where that one answers JSON; `ci.yml`'s
checkout and setup-node pins, `drift.yml`'s `schedule:`-plus-`workflow_dispatch:`
header and `mobile-e2e.yml`'s concurrency block and its "nothing continues on
error" rule. **Added** — `scripts/kernel_main.ts` and the workflow, because
nothing here could read a moving `main`: `catalog.ts`'s `raw()` refuses any host
but `github.com`, its `fetchAt` carries no authorisation and every caller hands it
a _recorded_ commit, and `drift` prints what moved and exits 0 whatever it finds,
so an existing unit could fetch a pin but not a tip; `endpoints()`, the one owner
of a kernel fetch address; and the two document judges. **Made reusable** —
`endpoints(d).raw(file,
commit)`, so the generated client (T-0287) feeds its generator the same bytes at
the same commit instead of growing a second address rule; `isRecord`, now exported
where a third copy would otherwise have been written; and a workflow file held to
its own rule by a case in `tests/kernel-main.test.ts`, which is the shape
`tests/advisories.test.ts` already used for `drift.yml` and is how this repository
keeps a check from dying by somebody switching it off.

[testdata/design-tokens.json](testdata/design-tokens.json) is the palette's
source and a build input: the native fingerprint hashes it, so a token change
is a binary change the `android` workflow rebuilds for. To refresh it, project
the export at a published PlatformKit commit, record that commit, then
regenerate the palette and the fingerprint. From that repository's root and
this one:

```sh
go run ./tools/designexport | jq '{schema, themes}' > "$MOBILE/testdata/design-tokens.json"
git rev-parse HEAD                                    # the commit to record
npm run tokens -- --upstream <full-commit-id>         # writes design-tokens.source.json and src/ui/tokens.ts
npm run fingerprint
```

Without `--upstream`, `npm run tokens` regenerates the palette only, and
refuses when the fixture is no longer the export its provenance describes.
Commit the fixture, its provenance, the generated palette and the fingerprint
together, and say in the commit which commit the export came from and what
changed in the palette. Read [AGENTS.md](AGENTS.md) before contributing.

## Limits and reuse

The generated HTTP client covers the pinned document only; composition-specific
clients remain downstream work. Outside that document, the generic page adapter
checks `items` and `total`, the fields its consumers read, but does not check
`limit` or `offset`; this is a limit relative to the full documented page envelope.
The six generated ESLint array-style warnings remain accepted warnings; the lint
rules and generated source have not been relaxed to hide them. Native Request,
FormData and device journeys still need platform verification.

**Reused** — the existing per-API bearer, deadline and cancellation transport,
core catalog compatibility rules, path derivations and shell generation guards
carry the generated operations into the current screens.
**Added** — the pinned public OpenAPI document, offline generation and drift check,
generated TypeScript and Zod contracts, and required custom-response validators
make response acceptance explicit before data reaches a screen.
**Made reusable** — `@septagon-oss/platformkit-mobile/generated`, each shell API's bound
`operations`, and `request(method, path, validate, body?)` let renderer packs consume
the documented operations and validate their own JSON routes through that transport.

A second factor, and the key a phone signs with, are this delivery's own, so
they are named here rather than folded into the paragraph above. **Reused** —
`documented()` and the generated operations for every request the handshake
makes, `identity` and `issuedToken` as the two answers it validates,
`factorRequired`'s reading of the server's own refusal rather than a status code,
`SignInForm` (the code step is step props on the form that already existed, not a
second form), `kitCopy` for every word the step speaks in both bundled languages,
and `Session`'s versioned record, which gained the key's id and kept its
shape. **Added** — `signIn`'s `SignInAnswer`, so a factor is an outcome a screen
branches on rather than an exception each caller renames; `answerFactor`, which
sends a code back to the server that refused; the mint of a scoped key at
`auth-token-issue` and its spend at `auth-token-revoke`; `src/core/scopes.ts`,
which decides what a key may be narrowed to out of the catalogue the pinned
document prints; `grants.gen.ts`, that catalogue read out of the document by the
generator that already reads everything else out of it; `scripts/e2e/totp.py` and
the factor person `scripts/e2e/mobile_ci.sh` enrols; and `e2e/flows/sign-in-factor.yaml`.
**Made reusable** — `delegableScopes(permissions, declared)` is a plain function
over two arguments, so an app whose surface differs from this one passes its own
catalogue to the same rule, and reaches it without forking anything: `<Shell>` takes
that catalogue as `declaredGrants`, beside `KEY_NAME` and the `tokenName` that name
its key, and passes it to `createApi`'s last argument, whose default is the
catalogue the pinned document prints; and the sign-out answers `SignOut`, so a
product's screen
can tell apart the server having stopped the key, the person still having one to
stop, and a connection that held none at all.

Two limits belong with that. A key this phone _restored_ from secure storage
carries no sign-in session with it — nothing here stores a session, and only the
key is stored — and `auth-token-revoke` answers only to its holder, so signing out
with a restored key forgets it here and cannot stop it there. That is the contract
this phone builds to, and it is a refusal the screen says out loud — "This device's
key could not be revoked from here; remove it from your account's devices." —
rather than a signed-out screen letting the person believe the credential dead: the
account's list of its devices is the door that remains to a phone holding a key it
cannot spend. That sentence is owed to such a key, and to no other: a sign-out on a
connection that holds no key, and one whose key the server refuses as a caller it
does not know (the kernel answers a dead bearer at every door as an anonymous
caller — a 403 naming `AUTH_ANONYMOUS`, never a 401), leaves nothing live to
remove, and the screen says nothing about a key rather than sending the person to
remove a device that is not there or already stopped. The sentence is about the key
and nothing else: when the server stopped the key and then failed to close the
sign-in that minted it, the phone says nothing, because that session sits in no
store, is presented by no later request and left this phone's memory with the call,
so there is no door left to walk to and no second ask to make — a notice spent on it
would report a stopped key as live. Whether the kernel ever
gives a scoped credential a door to retire its own key is the kernel's to decide;
if it does, a restored key stops itself at sign-out, and this paragraph and the
words above change with it. The
device journey for the code step is a state behind a password, so
`design gate` measures `/sign-in` and not the step, and no emulator ran on this
delivery: SecureStore and native cookie behaviour remain unproven here.

A write made where no network reaches is kept on the device and sent when one
returns. `createOutbox` holds `{kind, resourceKey, path, body}` under the selected
server and the signed-in person, mints one `Idempotency-Key` per write before its
first attempt leaves the phone and hands it to the screen's own typed call — the
held row keeps that same string as its id, so the attempt that may have landed and
the replay that follows name one write — and drains held writes in append order,
one at a time, sending with the session current at send time. A 4xx stops that
write alone and keeps the server's decoded reason for Retry and Discard; a server
that is present and unhappy stops the pass; a deadline after a send makes the write
`unknown`, which only a person may resolve, because the kernel ignores the key
until T-0293 lands. `createReadCache`
answers an unreachable read with the last response this phone got for that exact
path, and a list and a detail ask it: both read through `answered()`, which
answers from the cache when the server cannot be reached at all and calls
straight through where the shell has no device store. The address is the
request's own, spelled by `listQuery` and `rowAddress` in `src/effects/api.ts`,
so a page that lands replaces the page it is for rather than sitting beside it
under another name. What `answered()` says about where the answer came from is
drawn: a list or a record the phone answered rather than the server carries the
`offline` line with the moment it last arrived, said by `deriveOffline` in
`src/core/feedback.ts` and drawn by the same notice a refusal uses, in the copy
table's own words in both languages. A form and a singleton still call `Api`
directly: a form's fields are the person's own, and a singleton is one row.
Signing out clears what is held, so every door that leaves a sign-in — Home's
account menu, the sign-in screen's way to another server, and its clearing of a
saved sign-in — goes through `useSignOut`, which asks and names the count while
this phone still owes the server a write.

**Reused** — `createApi`'s deadline, problem decoding (`ApiError {status, detail,
fields}`) and `writePath`/`commandPath` addressing, `row`/`page` validation,
`src/core/feedback.ts`'s `offline` state with its `updatedAt` line, `copy.state.*`,
the shell's `writes`/`wrote` staleness counter, `src/effects/session.ts`'s ordered
chain and versioned-record rule, `src/ui/chooser.ts`'s `confirm`, and routebook's
store discipline (serialise, parse-on-read, one size constant read and written,
refuse to move another's record).
**Added** — `src/core/outbox.ts` (the held-write record, its state table, the body
and key bounds), `src/effects/outbox.ts` (hold, submit, retry, discard, a drain
that runs on the queue's one lane and keeps a refused item where it is),
`src/core/read-cache.ts` and `src/effects/read-cache.ts` (which answer earns a row,
which address it answers for), `src/effects/native-store.ts` (`expo-sqlite`,
`PRAGMA user_version`) and `src/effects/native-reach.ts` (`expo-network` as a
trigger only). Nothing existing
could carry them: the kit's only device storage was one secure session record, and
`RequestOptions` could carry no header a caller chose, so an idempotency key could
not be sent at all. `answered()` is how any screen asks for a read it wants answered
from the device, and `listQuery`/`rowAddress` are how its address is spelled, so no
caller has to guess how the transport spells a window.
**Made reusable** — the two table ports (`OutboxStore`, `ReadStore`) with a
conformance double beside them (`tests/fakes/store.ts`) that enforces the scope rule
in every method, the `Idempotency-Key` request option on `Api.request`, the `may`
port through which a composition re-checks its own catalog rule before a held verb
is re-sent, and `DeviceStore`/`createReach` as the pattern of putting one native
module behind one port.

### Limits and reuse of the held write

- Ordering says _the queue's writes keep their own order, whoever asked for them_,
  because two writes to one record are statements about the same row and the older
  one that lands last takes the newer edit off it. One queue runs one write at a
  time, so a Retry pressed while a drain is waiting for an older write's answer
  waits behind that answer. Serial sends are not yet ordered ones, so `overtakenBy`
  in `src/core/outbox.ts` says who is next: a Retry on a row that an older held
  write of the same record is still ahead of runs the queue from its head and takes
  that row when its turn comes rather than pushing it past, and a write made while
  the phone is back online goes through the caller's own call — the response is
  what the screen needs to close its sheet — behind the writes the queue already
  holds. `Outbox.submit` still answers `sent: true` the moment the server answers
  that call, which is the only answer a form can use, and it never waits for the
  drain it asks the queue for afterwards — only for the writes that came before it.
  When that wait ends with an older write of the same record the phone could still
  send — one the server told it to wait (5xx, 408, 429) or never took, or one a 4xx
  left refused for its person — `submit` keeps this write and answers `sent: false`,
  the answer a phone with no network gets, rather than landing an edit the older
  write would take off the record the moment its person retries it. The form stays
  open saying the phone holds the change, and the write leaves with the row it
  waited for. A blocked write holds back only the writes to its own record: another
  record's write, and a second create, go on the wire at once.
- A 4xx stops its own write and the queue goes on past it, including past a later
  write to the same record, because `next` picks up the first queued row: a refused
  write a newer one has since overtaken can still be retried, and then lands last.
  Nothing on the phone can tell a refused write whose record has moved on from one
  whose record has not — only the server knows, and it answers again at the next
  send — so the row is named as refused and that retry stays the person's decision.
  A write made now does wait behind a refused row, so this gap is the drain's
  carrying a queued row past a refused one, and resolving the refused row — Retry
  or Discard — is what puts the order back.
- A request that is already on its way cannot be discarded: `discard` refuses a
  row in `sending`, and the row shows Discard disabled while it is busy, because
  the answer will move that row whichever way the person feels about it now.
- A `fetch` that rejects after the request left but before any header arrived is
  indistinguishable from one that never left, and no client change can tell them
  apart: the phone holds such a write and may send it twice. Both attempts carry
  the one key the queue minted before the first left, which is what lets a kernel
  honouring `Idempotency-Key` (T-0293) match them and answer the replay with the
  first answer; until that lands the key is sent and ignored, and the duplicate is
  possible. What the client can and does stop at the case it can see — an answer
  whose body was cut off is never re-sent.
- A phone that cold-starts with no network cannot say who its saved session
  belongs to: `identity` comes only from a server that answers, so until one
  reaches the server once the app holds nothing and shows nothing that an
  earlier run left. The rows are on the device and appear at the next load that
  reaches the server.
- The composition root supplies the device store, the key maker and the network
  listener, so the app holds, sends and reads. A page answered from the device is
  drawn as what it is — `deriveOffline`'s line above the rows — but the line is
  the whole of what it says: no screen offers a "work offline" switch, and a list
  never prefetches a window nobody has asked for.
- The queue's cases are `node:test` files under `tests/` (`tests/outbox.test.ts`
  and the held-write files beside it), run by `npm test` beside the Jest suite; the
  brief asked for Jest with a fake network, and the fake network is the same one
  either way — `tests/fakes/store.ts` plus a `fetch` the test supplies.
- Nothing here has been seen on a device: no `e2e/flows/held-write.yaml` exists,
  and `expo-sqlite` is exercised in tests through a `node:sqlite` stand-in that
  binds parameters the way the native sources do.

## Say what went wrong in plain words

A person reads a sentence, never a status code. `src/core/failure.ts` classifies
one refusal together with the reason the screen asked for it — a first read, a
refresh, a create, an update, a delete, a command, the catalogue — and answers
with one copy key, one `IssueCode`, one action and whether the record stays on
the screen. A refusal the server answered may be asked again; a write nobody
answered is never sent again, which is why an unanswered save offers "Check the
result" or "Dismiss" and never "Retry". `src/screens/failure.ts` is the single
adapter from a thrown error to those facts, and the record, list, form, singleton,
command and named-operation hooks, the shell's catalogue load and both generated
screens draw the verdict instead of `e.message`. The activity trail's hook is the
one read that still classifies its failure inline, so its sentence is the last
wire text a phone can still be shown.

**Reused** — `ApiError` with its `status` and `fields`, `IssueCode` and the
immutable/correctable split `src/core/presentation.ts` already owns, the state
machine in `deriveState` — whose rule that an immutable code carries no retry is
what the grid's (code, action) pairs are held against in `tests/failure.test.ts`,
while `refusalAction` is what picks the one button a screen shows,
`issue()`'s recovery rule, `presentedTime` for the instant a refresh quotes,
`plural`/`humanize` for the nouns a sentence names, `Notice`'s existing props, and
`copy.state`'s `retry`/`dismiss`/`reconcile`/`unknownWrite` words. **Added** —
`src/core/failure.ts`, because the tree could report a failure and could not
classify one: no existing unit reads a status _and_ a context, and a new module
would have duplicated the closed `IssueCode` vocabulary; `Words.failure` (seventeen
keys in `en` and `pt`, of which `thisRecord` and `thisWorkspace` are the two nouns
a sentence names when no catalogue entry describes what it addressed), because the
copy table held state words but no sentence
that names what failed; `copyForLocale`, because a device locale is not one of the
two languages the table holds and `deriveCopy` stays closed — and the phone itself
is asked in `src/screens`, never in the core; `ResponseError`
exported, because a body this build cannot read was indistinguishable from a
server that answered, and the alternative was pattern-matching the English string
`Invalid response at` — a wire string on screen. **Made reusable** — the
(kind x context) grid as a test fixture in `tests/failure.test.ts`, which is the
same table the classifier is written against and is run through the real
`deriveState`, so the next sentence is added as a row and not a rumour;
`refusalAction`, the one place that decides which button a refusal offers;
`failureTone`, the one place that decides whether a sentence is drawn as an error
or as a caution;
`screenCopy`, the one place the phone's language becomes words; and
`FailureSubject`, so a screen that has a noun to name has one way to hand it over.

## Asked to sign in again

A server that refuses a session this app was in the middle of using asks once.
The transport reports the refusal at the one line where a status becomes a
throw, `src/shell.tsx` alone decides whether it ends a session, and the person
lands on sign-in with the sentence that says "again", their email prefilled,
and — held for them — the address they were standing at and what they had typed
into an open sheet. An attempt the server refuses leaves them exactly there with
the same address and the same draft: a mistyped password is part of coming back
in, not the end of it. Whoever completes the sign-in is compared with who the
refused session belonged to before the new catalogue is drawn, so a different
person starts at Home with none of it, and signing out leaves it behind at that
moment rather than waiting for whoever signs in next.

**Reused** — `src/core/state.ts`'s phases, generation drop and reducer, the
generation discipline in `src/shell.tsx`, `ShellValue` and `useShell`,
`createApi`'s single line where a status becomes a throw, `copy.failure.signedOut`
through `sentence()` (the sentence already existed in `en` and `pt`; none was
added), `src/effects/session.ts`'s versioned `clear(baseURL)`, `src/core/derive.ts`'s
`screenPath`, `useFocusEffect` as the screens already use it, `Notice` (its
`action` is already optional), and `tests/fakes/router.ts`'s `Redirect`.
**Added** — one `expired` event and one `reason: "expired"` field, because a
session the server refused is not the ordinary sign-in screen and every existing
phase already meant something; the `refused` notice on `createApi`, because a
per-hook 401 branch is a rule repeated in every hook and the brief forbids it;
and `src/core/reentry.ts`, because nothing in the tree compared who a session
belonged to with who is signing in now, or spelt a screen's address beyond
`screenPath`. **Made reusable** — `saw`/`typed`/`keep` on `ShellValue`, so a
screen reports where it is and a sheet's typed values have one holder that any
other sheet can be filed the same way (the next one is a command's arguments,
named under **Limits** below);
`navigations` in the router fake, which makes "did the app take the person
where they meant" an assertion instead of an inference; and the
`tests/shell-expired-session-*.test.tsx` files as the shape of a session test:
the real `<Shell>` over a recorded fetch, with the routes that walk the return
leg mounted inside it.

**Limits** — only a record form files what a person types into it: a command's
arguments are not carried through the sign-in, so returning to a command sheet
starts with empty fields. What is held lives in memory for the one sheet that was open, so a
relaunch starts at Home. Identity on this wire is the server that made the
session and the user id it named — the kernel answers no tenant here, and none
is inferred from a catalogue or a resource id. A session the server never
identified leaves no address, no email and no text behind, and a boot-restored
cookie that is already dead keeps today's path: the sign-in's own notice about
the saved sign-in, not this one. A cookie expiring on a handset is not proven
here; the cases run against the real `<Shell>` over a recorded fetch.

## Each workspace's face

The phone asks a workspace what it is before it asks who you are. `GET
/api/v1/app/connection` is read at the address a person is connecting to, and again at the
one a session opens at, and its answer — the name that place uses for itself, the colour it
wears and the path of its mark — becomes `./core/workspace`'s `Workspace`. The name reaches
the header, Home's band and the line over the password through `workspaceName`, which reads
the answered word first, the typed address second and the copy table's word last, so the
three can never call one place two things. The colour is worn by `accentPalette`: it copies
the generated palette and replaces its accent roles with the nearest shade of that colour
that keeps every pair `contrastPairs` measures, in both modes at once, and returns the kit's
own pair by identity when no shade does — a workspace is never legible by day and refused by
night. `src/ui/tokens.ts` remains the only writer of colour and `npm run tokens` the only way
into it. What this device has been pointed at is remembered as a name, a host, a mark and a
moment in the `workspace_seen` table, which reaches `Shell` as the device's fourth table
through `./screens/device`: never a credential, so a remembered workspace can fill an address
and cannot sign anybody in, and never a colour, because a colour belongs to the place a person
is standing at. A face carries the origin it was read from, which is why its mark is asked of
that origin and of no other — on a phone built against one server whose person typed another,
and on a phone that pressed Change. An address that answers nothing — a refusal, a dead
network, a body outside the document — is named by its host and asked for a password like any
other, because a phone that could not read a workspace has not proved there is nothing there.

**Reused** — `ThemeProvider`'s existing `palette` prop and `themeFor` (a palette in, one
theme out), `contrastPairs` as the measure the worn shade is chosen against, `core/color`'s
`mix`/`contrastRatio`/`AA`, `Api.operations.appConnection` bound through `documented` (the
deadline, the origin check and the pinned `zAppConnectionResponse` stay in the path), the
`recents` optional-slot shape for `store.workspaces`, the `recent_open` migration shape,
`Row`/`Section`/`ServerField`/`Button`/`Screen`, `NativeImage` as the app's own image view,
`extent.rowMedia` for the tile a remembered row's mark sits in,
and the copy table for every new word in `en` and `pt`.

**Added** — `accentPalette`, because the theme offered a palette in and `core/color` only
arithmetic, and nothing turned one incoming colour into a pair of accent roles that keeps a
measured registry (one colour cannot reach body-text contrast against both canvases, so a
raw fill would be illegible in one mode or refused by the suite); `./core/workspace` and
`./effects/workspaces`, because `workspaceName` was the naming rule and `session.ts` is one
record under one key, so a list of visited servers was new state on the recents pattern;
`WorkspaceTheme`, because `Shell` and `ThemeProvider` were rendered adjacent with nothing
between them and `src/ui` may not read the shell; the address step, because the form asked
for an address and then a password with nothing read in between.

**Made reusable** — `Workspace` as the one shape a workspace's face takes (so an Account
surface or a switching menu reads a value rather than a document, and `rememberedFace` reads a
kept row back as one), `rememberedStamp` with
`createWorkspaces` as a device table a product can supply its own copy of, and
`./screens/WorkspaceMark` — a mark built from the address that named it and drawn by
whatever renderer the app ships, which is what any other workspace-owned picture needs.

**Limits** — The accent is worn from the connect step's lookup, not from after the sign-in: a
workspace's colour is what its own document says, and waiting for a session to paint the screen
that reads that document would paint nothing while the person is still choosing the place.
`Account` carries no mark, because there is no Account screen to carry one: Account is the
header's action sheet, which names the person rather than the place, and the mark sits on the
two surfaces that identify the place — the connect step and Home's band. After a sign-out or an
expired session the credentials step names the host and draws no mark until the next document is
read, because dropping the key is what drops the face worn with it. A remembered row is a name,
a host, a mark and a moment, five of at most eight listed, and no phone reads a colour from it.
A lookup that answered nothing is said by the host standing where the answered word would have
been and by no sentence: the phone cannot tell "no workspace here" from "this network is
lying", and an address that is a typo is refused at the password, where the server can say so.
The `workspace_seen` statements run against the SQL through the same `expo-sqlite` stand-in the
rest of the device store is read with, which is the statement and not the device's own file: the
bounds are what an in-memory SQLite agrees to, and a real phone's WAL is unexercised here, as are
the two changed flows, which belong to `make e2e-android`.

## Opened by a link, and reached by a notification

A link in an e-mail, a link another app opens, and the address a notification carries are one
question — _where does this person want to be_ — and this phone answers it once, in
`src/core/arrival.ts`. The surface is the kernel's own: `app`, the root its generated shell is
mounted on, then the two words of a resource, then at most one record. `platformkit://app/note/notes/7`
and `https://platformkit.example/app/note/notes/7` answer the same href, because the host is
where the person signed in and says nothing about the address; a query, a fragment and a port
say nothing either. A link that does not open on that surface is left where it is — the router
has always routed what it was given, and the gallery and the command journeys depend on it —
and a link that opens on it and breaks its shape opens the start of the app, which is a real
place, rather than the router's own not-found page, which names nothing. Arrival is not
authorisation: a record link lands on the record's screen, which asks the server and draws the
kit's refusal when the answer is no.

Android routes an HTTPS link to the app only when the host says it may, so the manifest claims
one host and no other: the one the build already connects to, through `EXPO_PUBLIC_API_URL`,
over HTTPS, with `autoVerify`. A build that names no server — every development checkout, and
the emulator's `adb reverse` — carries the private scheme alone. Serving `/.well-known/assetlinks.json`
per tenant host, with this binary's signing fingerprint, is the kernel's to serve and no
client's to write: the phone can claim a host, not vouch for it, and nothing in this
repository proves a verified Android association. iOS is untouched here.

Notifications arrive through `expo-notifications` behind one bridge (`src/screens/push.ts`) that
the composition root hands the shell beside the store, the mint and the network listener. The
session owns the address: after a completed sign-in it names the Android channel, reads what the
platform already recorded, and registers the Expo token through the devices door. That door
answers to the holder, not to a scoped key (`x-platformkit-auth.kind: signed_in`), so it is
asked with the sign-in session behind the key, as the mint, who-this-is, the revoke and the
sign-out are; a phone working from a key read back out of storage holds no session and hears
that door's own refusal. The prompt is never opened unprompted: the sentence and its two answers
are a person's own (`push.turnOn`), spent once per sign-in either way. A token is memory-only,
like the key that reaches it, and so is the row it became — held with the sign-in that wrote it,
so a session the server ended leaves no address behind for whoever signs in next, at this server
or another. Each of those three is kept under the connection that wrote it — the pass in
flight, the row whose answer is still away, the row it wrote — so a sign-in made while an
earlier session's answer is pending runs its own pass and gets its own row, instead of
being handed an ended session's promise that nothing will ever answer. A refusal holds the
same scope: a workspace that answered no to this phone's address is not asked again in that
session, and a no that answers late is still the ended session's, never a reason for the
workspace signing in now to keep silent. And because the server keys a device on tenant,
platform, token and recipient, a newer sign-in that reuses an older session's token holds
_that_ row from the moment its ask lands, whichever answer reaches the phone first: the live
session is the one that may give it back, so an older sign-out — whether its own answer came
home first or last — leaves the address the person at the phone is signed in with untouched, and
asks for a row of its own only behind an ask for that same address. The registration's answer
hands responsibility for cleanup to that connection even if it signs out before the answer
arrives: its own sign-out removes the row or hands it to the next registering connection.
Each sign-out waits for its own registration and at most one matching address already being
registered, without chasing later sign-ins. A server that will
not carry this device, a phone with no push service and a person who says not now all
leave the session standing and say one sentence. Sign-out asks for the row back _before_
it spends the key, waiting for a registration of that address still on the wire, because only
that key reaches the row, and it says so when the ask did not answer — while the key may still be
live, the key is what is said. The key it forgets here is only the record that sign-in
wrote: a person who signed into another workspace while the row was being handed back
keeps the sign-in this launch would restore. No asking holds that forgetting — the record
is put away before the first request leaves, so a phone signed out and then closed while
an answer is away opens signed out for whoever picks it up, not into the session that was
just ended.

**Reused** — `screenPath` and `address` (`src/core/derive.ts`, `src/core/reentry.ts`), which
still spell every route and gained `rowAt` so a link arrives at the same href a screen leaves by;
`ResourceRoute`'s catalogue-miss `Notice` and the `access` row of the failure grid, which are the
refusal a link lands on; the generated operations for the devices door, reached through the pin
this delivery moved and not through a hand-written request; `Notice`'s `action`/`secondary` pair;
`Announcement`'s mount beside the navigator; `src/effects/native-reach.ts`'s bridge shape; the
copy table, `kitEnglish` and `kitPortuguese` together; and `e2e/flows/detail.yaml`'s ids, which
`deep-link.yaml` reuses rather than inventing.
**Added** — `src/core/arrival.ts`, because nothing in this repository could read a URL back
(the only reader of a path was the router itself) and a link parser that re-spelled routes would
be a second implementation of the address rule; `app/+native-intent.tsx`, which is expo-router
57's only hook for a system URL and is one line of delegation; `app.config.ts`'s `intentFilters`,
because a verified link is build input and there was none; `src/screens/push.ts`, because no push
client existed and `src/effects/**` may not name one; and the shell's push lifecycle, because the
session is the only thing an address is scoped to.
**Made reusable** — `rowAt`, the one spelling of a record's route, which every caller of
`address("detail", …)` already used without naming it; `systemHref` exported from
`src/route.tsx`, so a link, a notification tap and any later arrival share one reading;
`PushBridge`, four questions with no decisions in them, which a web host or a product with its
own push client can answer instead; `tests/fakes/push.ts`, which lets any later suite set the
platform's answers rather than mock the library; and `scripts/check_flows.ts`'s exemption of
`+`-prefixed files, so a router configuration file is never asked for a journey that cannot land
on it.

_Verified_ — the reading of a link, the door it arrives at, and a device row's hold on the
sign-in that wrote it run under `npm test`, in both halves. `e2e/flows/deep-link.yaml` never ran:
it needs `make e2e-android`, an emulator, `maestro` and a signed-in kernel, and this delivery had
none of them, so the link and the notification tap are proven through expo-router's own reading
and not on a device.

## Read the first journey end to end

A tenant's first screenful is a list of records, one record, and the command
sheet that changes it. Three surfaces decide whether that reads as a product or
as an inventory: what the sheet says it runs, what a pointer at another record
shows, and whether the words on screen are the server's or the phone's.

**Reused** — `confirmation.body` and `successMessage` on `CommandHints`, and
`reference.resource` on `FieldHints`, as the words and the mounted resource the
kernel already serves; `saidValue`'s way of letting a hint decide what a field
reads as; `NameFields.displayName`/`title`/`name` and `humanize` for reading a
name off a record; `kitCopy`, so the two words a document cannot name belong to
the kit; `pick`, `list`, `screenPath` and `key` for the reads themselves;
`Button`, `LabeledValues`, `Value` and `Chip`, which draw the sheet and the
pointer without a new atom.

**Added** — `commandWording(entry, actsOn, copy)`, the one wording a command
sheet speaks and the line a success leaves behind: the command's own label, the
title of the record it runs on, the consequence the server described (or the
summary, when the server gave a title and no body), and `{label} done` when it
gave neither; `pointedAt`, `referenceWordFor` and `pointerTargets`/
`controlPointers`, which read a pointer as the name it resolved to, as
`Assigned` for a person and `Linked` for anything else, and never as the
identifier it holds; `Names` and its key, so a resolved name travels to the
place that draws it instead of being looked up there; `useRecordNames` and
`useDirectoryNames`, one read per record on a record's screen and one page per
resource on a window of rows; and `e2e/flows/first-journey.yaml`, the signed-in
journey that makes a record with a deadline, reads its state pill and its
deadline with no identifier on the screen until Record information is opened,
finds it again through a filter, amends it and deletes it.

**Made reusable** — `Names` as the prop every surface that draws a field takes,
so the next module with a pointer pays nothing; `acts` on `ResourceForm`, the
subject-and-consequence pair any command sheet can hand the sheet body;
`pointerTargets`/`controlPointers` asking only what the medium draws, so a
screen that shows two facts reads two records; the settled-map discipline in
`useReferenceNames`, where a refusal ends that pointer for the visit and a
withdrawn session ends every name at once; and the `DUE_FIELD`/`STATUS_FIELD`/
`STATUS_VALUE` the journeys now read from the environment, which is what lets a
second client's flow exist without a word of its product in this repository.

## People and row pictures

**Reused** — the catalog parser, `derive.ts`, `Names` and its reference hooks,
`Row`, `Value`, `DataList`, Home, Activity, theme/scale, `fileResource` and
`NativeImage` compose the existing authorized read and presentation path.
**Added** — pure person/media models and the native `Avatar`, `AvatarStack` and
`RowMedia` molecules provide compact faces, overlapping groups and leading
pictures because the existing full-frame media hero cannot carry those shapes.
**Made reusable** — `People`, `Row.leading`, the declared picture-door/width
planner, session-scoped image adapter and genuine read-scoped catalog fixture
serve the next resource without another transport or design system.

The HTTP fixtures and generated API pin public kernel commit
`aa35944f576e143190ea67ba12bf812dd1b4cc0c`. Optional `pictures.source` and
`pictures.widths` choose the byte door and variants; `thumbnailField` defaults
to a valid `coverField`. The parser diagnoses defective optional declarations
and keeps the resource. It accepts a restricted root-relative `/api/v1/`
template with one `{id}` segment, never a remote URL. An explicitly selected
thumbnail with an empty value uses the icon fallback, rather than another field.
Home uses the declared icon tile or the generic grid. The sixteen resource
icons share the existing Icon adapter.

People come from declared person values, declared user references, activity
actors and the authenticated account. Initials use Unicode code points; their
stable ID hash selects info, ok, warning or neutral, never danger. Groups keep
three discs and a localized remainder; their single spoken description includes
the whole group. A portrait is the first visible declared `present: avatar`
field, with no field-name inference. Existing reference reads produce names and
portraits together: one record read per distinct pointer, or one page of at
most 200 people per target and list visit. A refresh starts a new visit and keeps
the previous names and portraits while reading; transport and server failures
keep that answer. A successful answer replaces it, including removed people or
portraits; a 401/403/404 withdraws it. Each record or directory answer applies
as it settles, so a pending peer cannot delay a refusal and a later transient
refresh cannot restore the withdrawn projection. Loading more rows reuses that
directory page.
Account initials use `displayName`, then
email. A declared account portrait permits one own-record read; the pinned
reference user/identity contracts have no portrait, so they need no extra read.

Stored compact pictures use the current session's bearer header, never a
query token.
The shared compact-picture/prose width planner uses the stored original when
the selected declared width exceeds the known frame; small originals never
request a larger variant that the server cannot build.
The mounted `file/file` metadata read is coalesced per visible ID. A metadata
403/404 immediately withdraws that file's bytes without waiting for other metadata
reads; a superseding refresh cannot erase a settled refusal. Refresh keeps the
displayed resource and its slot states while metadata is pending or fails
transiently, only within the same session and catalog scope. A first transient
metadata failure permits only the
uncached declared door; it never restores a resource a refusal withdrew.
Fresh public metadata with a content version permits
`expo-image` memory caching. Private, unknown and unversioned media uses
`cachePolicy="none"`; no image bytes enter disk storage. Cache identities include
server, person, key, session/visit, source, file, version and planned width.
Each slot retains its own loading/failure state even when files are shared.
That state also names the file, so a replacement starts loading independently
of the old file's slots. Each successful metadata answer renews only its own file.
Replacement and scope loss withdraw old resources immediately; memory purging
is best effort. Loading uses canvas or initials, failures use the declared icon
or initials, and transitions remain zero under both motion preferences.

The [component and lifetime contract](docs/people-and-row-pictures.md) specifies
fallbacks, visibility, validation and product-owned decisions. Gallery samples
include initials, unknown names, loading/ready/failed portraits, groups and row
media. `testdata/catalog.pictures.json` is a genuine authenticated response from
the public reference composition at its original recorded capture commit, using
the read scopes recorded in its source receipt. It establishes that fixture's cover, thumbnail, author and
assignee contract. The pin's file icon is outside its frozen vocabulary and
uses the documented fallback. The broader admin catalog includes translation
map inputs this client's supported field kinds still refuse; this delivery does
not add map editing or general catalog compatibility.

Verification is recorded per delivery. Component and hook tests inspect names,
loading/failure, scoped headers/cache keys and obsolete completions. They do not
establish Android/iOS rendering, redirects, actual native cache reuse/eviction,
revocation or TalkBack/VoiceOver output. The browser preview's design probe does
not measure React Native Web's div-based text; its zero-refusal report is not a
native visual or accessibility verdict.

## Composed pictures

A catalogue version 3 scalar `picture` with `present: image` can supply a generated
list's declared thumbnail or default cover thumbnail. Its canonical `c1.` reference
identifies a server source, and `pictures.composedSource` supplies the root-relative
`{reference}` door. The phone draws the received SVG; templates and source access
remain server-owned. Derived pictures never enter forms, writes, sorting, filters
or textual facts. Unstamped and version 1–2 catalogues remain supported.

`api.composedPicture(source, reference, { signal })` uses the private in-memory
sign-in cookie alone because this door requires `SignedIn`. A restored bearer has
no such session and shows the existing empty picture until a fresh sign-in. No
cookie enters a resource, component or store. SVG reads use the existing transport's
deadline and cancellation, request no caching or redirects, accept only a 200 SVG
response of at most 1 MiB, and render with the installed `react-native-svg` parser
and tree. A fetch, parse or render failure uses the declared icon or no compact slot.
Refresh, replacement and scope loss discard old XML immediately; no SVG is retained
as an offline or persistent image. Stored pictures keep their existing behavior.

**Reused** — `parseCatalog`, core picture/row derivation, `createApi`, `usePictures`,
`NativeImage`, `RowMedia` and the pinned `react-native-svg` compose the existing
session and presentation path. **Added** — the composed-reference validator,
session-only SVG response mode and XML resource alternative bridge a contract that
the stored UUID metadata/URI loader cannot carry. **Made reusable** — any resource
can declare a composed thumbnail, with the domain-free server Oracle, synthetic
catalogue example and shared fetch/render/lifetime conformance cases available to
the next consumer.

`testdata/catalog.composed.json` is synthetic; `testdata/composed-picture.svg` is
the public foundation's independently authored Oracle at the receipt's commit.
The ordinary reference application does not compose the picture module. A real
composed-server device run can extend `record.yaml` by supplying `COMPOSED_MODULE`,
`COMPOSED_ENTITY`, `COMPOSED_READY_TITLE` and `COMPOSED_REFUSED_TITLE` to
`make e2e-android`. These select a resource containing a fixture-SVG row and a 403
row; the flow records `composed-pictures` and `composed-pictures-refreshed`
screenshots for visual inspection, then continues the existing record journey.
Without these inputs that fixture visit is skipped. Selector checks do not prove
SVG pixels. Android/iOS drawing, native Cookie/redirect handling, screen readers,
live grants/revocation and session-switch behavior remain unverified. Composed
detail heroes and galleries are outside this delivery. The
[fetch/render contract](docs/people-and-row-pictures.md#composed-pictures) records
the supported inputs, refusals and lifetimes.

## An empty list is drawn

**Reused** — `resourceIcons`, the catalogue's own icon refusal, `deriveState`'s
rule that a refused input yields no partial model, `StateInput`/`StateModel`,
`StateView`, `EmptyState`, `Skeleton`'s motion-prop precedent, `Sparkline`'s
labelled-`View`-carries-the-words pattern, `useTheme`/`useStyles` and
`src/ui/scale.ts`'s `extent` compose the empty screen this delivery draws.
**Added** — `src/core/illustrations.ts` (the drawing table, one 48-unit canvas,
one safe area, the `card`/`ring`/`poly` builders), the `Illustration` atom,
`StateModel.illustration`, `entryIcon` and `scripts/illustrations.ts`, because the
kit held no drawing at all — its only two `react-native-svg` units plot a
responsive chart — and the model that fills the empty state could not name one:
its `icon` is a four-word glyph union every empty kind shared, so a list of
people, a list of invoices and a list a filter had just emptied all drew the same
generic folder. **Made reusable** — the table is keyed by the icon word a catalogue
declares and is emitted byte-for-byte to `assets/illustrations/<name>.svg` by
`npm run illustrations`, so the web workspace embeds the identical set instead of
redrawing it; `extent.illustration`, the three builders and
`tests/illustrations.test.ts`'s geometry reading are the block the next picture,
tile or empty screen is drawn from.

Eighteen drawings: one per icon the catalogue may declare, the generic one an
entry that declared none gets, and a magnifier for the empty a filter caused.
Every one is authored on `illustrationCanvas` (48 units) with every coordinate
inside `illustrationSafeArea`, in absolute `M`/`L`/`C`/`A`/`Z` commands only, at
most eight parts, and drawn in two inks — `line` for the outline, `detail` for the
one or two parts that say what the object is. A part names an ink and never a
colour: the atom answers `line` with `textPrimary` and `detail` with
`accentDefault`, so the set follows the theme, and an emitted file answers them
with `currentColor` and the kernel web stylesheet's own
`--pk-color-accent-default`, falling back to `currentColor` where that property is
undefined. `tests/illustrations.test.ts` reads the vocabulary, the geometry and the
bytes on disk off the one table; a missing drawing also fails `npm run typecheck`,
because the table is a `Record` over the same closed set.

The picture arrives as part of the state model, not as a screen's decision:
`deriveCatalogList` passes `illustration` — the magnifier when a filter is what
left the list empty, `entryIcon(entry)` otherwise, the generic one when the entry
declared nothing this build draws — and `StateView` hands it to `EmptyState`, which
draws it above the title it was already given. No string moved, so no device
journey changed. A state whose picture is named by a kind that draws none, or by a
word outside the set, or by the empty string, is refused whole, as every other
invalid state input is. The entrance is a 300 ms fade-and-rise on first appearance
and nothing at all under reduced motion, and it is a prop like every other motion
in the kit: `useFeedback` remains the only place the device is asked.

## The core has five doors

`src/core` is entered through five doors — `core/list`, `core/record`, `core/form`,
`core/command` and `core/present` — and each door's `index.ts` is the only path into
it. The gate in `eslint.config.mjs` refuses a part file (`../core/list/rows`) from
anyone, including a sibling door and the deprecated barrel, and the same gate keeps
the kit's gallery fixtures out of every door and every product file: they belong to
`src/ui/gallery.tsx`, which reads them from their own modules. `src/core/derive.ts` and
`src/core/galleryPages.ts` are exempted from the fixture ban alone — they are the
gallery's own share of `src/core` — and carry the core layer's own patterns with them,
so the exemption buys the fixtures and nothing above the layer. `src/core/derive.ts`
publishes every name it always published and is marked `@deprecated`, so a client's
import keeps answering while its owner repoints at the door the rule lives in. Two
names that met inside the barrel are told apart: `Control` is a field's editor
(`core/form`), and the drawn action that shared the name is `ActionModel`
(`core/shared`), the name the barrel already used for it.

**Reused** — the layer gate (`eslint.config.mjs`'s `forbid`/`uiLayer` and
`tests/layers.test.ts`'s `boundaries`), which took the door boundary, the fixture ban
and the layer's own patterns as cases of the rules it already had rather than as a
second gate, and `tests/package.test.ts`'s TypeScript AST walk, which names the doors
among the published subpaths. The copy table (`src/core/copy.ts`, `kitCopy.ts`) is what
the doors and the two product files speak with: the refusal of a verb the resource does
not mount, a list item that does not spell its own type, the distance an activity line
counts, the question a discarded sheet asks, the route whose entry is absent and the way
out to another server.
**Added** — the five door directories, `src/core/internals.ts`, the per-door boundary
and the fixture ban, because `derive.ts` was one 2,757-line barrel whose `export *`
list handed a screen that wanted a table the cart, the chart and the gallery fixtures
with it, and no existing file held a partition to reuse.
**Made reusable** — a published door path per derivation surface (38 subpaths, each
proved by `tests/package.test.ts` against a packed tarball), a gate case that proves
even the barrel enters a door through its index, and `ActionModel` as the drawn
action's own name; the next delivery that splits a core file inherits both the shape
and the refusal.

## A pack is one declaration

A custom screen belongs to a renderer pack, and a pack is now one statement rather
than a key guessed at and an operation named beside it:

```tsx
export const taskPack = definePack({
  key: "task/task",
  read: "taskTaskRead",
  input: ({ id }) => (id === undefined ? undefined : { path: { id } }),
  detail: TaskDetail,
});
```

`key` is checked against `entryReads` (`src/generated/entries.gen.ts`), the map
`npm run api` derives from the pinned document: for every `module/entity` it answers a
read of, the operations that answer it. So a key spelled past the document, a read that
answers another key, a `POST` offered as a screen's data and a row that draws a field
the declared body lacks are four compile errors — the last one is what `useOperation`
already proved, and the first three needed a map to be provable at all. `input` is
required: an operation may need a query or a body besides the id, and a default that
sent only the id would ask a confident wrong question of those operations. An `input` of
`undefined` asks for nothing, which is how a record screen with no id yet renders.

A declared screen is handed what it used to fetch for itself: `read` (a `ReadState`
whose `failure` carries the verdict behind `error`, so a refusal that draws no sentence
is still a fact a screen can act on), `present(field, value)` — the field's word, its
value and its shade as **this** entry's resolved policy reads them, from
`core/present`'s `presentFor` — `feedback`, and `actions`, the entry's own row commands
and the run that runs them. `definePack` returns a one-key record, so a composition
root writes `{ ...taskPack, ...invoicePack }` into `Shell`'s `renderers`; the
dispatcher and `Renderers` are unchanged, and a pack that reads a projection rather than
a documented operation stays writable as a plain record. `entry.renderer.name` and
`SHELL_VERSION` are kept, deprecated and listed in the changelog: a declared pack needs
neither, because its key is checked at compile time.

**Reused** — `scripts/api.ts`'s generation pass and its byte-for-byte `check:api`
(which took the new file as one more name in the tree it already compares),
`useOperation`, `useCommandRun` and `useFeedback` for the read, the writes and the
device's own formatting, `core/command`'s `rowCommands` for the verbs a row offers,
`core/present`'s `fieldLabel`, `enumLabel`, `saidValue`, `enumTone` and `badgeTone` for
every word and shade `present` says, `core/failure`'s `FailureVerdict` for what a
refusal is made of, and the existing layer gate, publish gate and test inventory for the
new door's three proofs. **Added** — `src/pack.ts` and `src/generated/entries.gen.ts`,
because the tree held no relation from a key to an operation to check a declaration
against: `OperationName` was one flat union of 170 names and `Renderers` was
`Record<string, Renderer>`, so the key and the read could only ever agree by convention,
and `presentFor`, because the six free functions that read a field existed with no
binding to an entry, which is why the example pack called `humanize` for every label —
a second implementation of a rule the policy already carried. **Made reusable** —
`entryReads`/`EntryKey`/`OperationFor` as the generated key inventory a write map or a
collection/item split can join, `presentFor` as a pure function over an entry and a
formatting that runs with no React, `ReadState.failure` as the structured half of every
read the kit publishes, and `@…/pack` as the one door a product imports to declare a
screen — all four proved by the suites that already run.
