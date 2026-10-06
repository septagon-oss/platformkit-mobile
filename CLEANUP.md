# The fold of tests named for a review round

Decision 0072 names a test for the behaviour it protects; which review, round or
task produced it belongs to git history, not to a name or a comment. Every file
`tools/review_named.py mobile` listed at the merge base `31dc830` — 48, none held
by an open task — is folded, and the count at head is 0. This file records where
each assertion went, because a rename that loses a case silently is worse than an
ugly name.

## Where each file went

Root Node bodies moved from `tests/<x>.spec.ts` — which `npm run test` never
globbed — into `tests/<behaviour>.test.ts`, and the two-line `import "./x.spec"`
shim that existed only to reach them was deleted. The Jest suites keep their
extension and lose the prefix; their dead `tests/screens/*.spec.ts` shims are
deleted, not renamed, because `jest.config.js` discovers `tests/**/*.test.tsx` and
nothing globs `.spec.ts` there.

| From | To | Note |
| --- | --- | --- |
| `tests/review-activity-directory-snapshot.{spec.ts,test.ts}` | `tests/activity-actor-snapshot.test.ts` | body → entry name, shim deleted |
| `tests/review-activity-scope-isolation.{spec.ts,test.ts}` | `tests/activity-scope-isolation.test.ts` | same |
| `tests/review-activity-withdrawal.{spec.ts,test.ts}` | `tests/activity-audit-snapshot.test.ts` | same |
| `tests/review-calendar-withdrawal.{spec.ts,test.ts}` | `tests/calendar-withdrawal.test.ts` | same, plus the overnight civil-day row |
| `tests/review-map-withdrawal.{spec.ts,test.ts}` | `tests/map-withdrawal.test.ts` | same |
| `tests/review-pricing-withdrawal.{spec.ts,test.ts}` | `tests/pricing-withdrawal.test.ts` | same |
| `tests/review-stepper-recovery.{spec.ts,test.ts}` | `tests/stepper-pending-write.test.ts` | same, plus the Portuguese refusal row |
| `tests/review-cart-withdrawal.spec.ts` | `tests/cart-quote-withdrawal.test.ts` | newly executed, plus the busy-checkout row |
| `tests/review-list-withdrawal.spec.ts` | `tests/list-selection-withdrawal.test.ts` | newly executed |
| `tests/review-media-snapshot.spec.ts` | `tests/viewer-snapshot-isolation.test.ts` | newly executed |
| `tests/review-media-withdrawal.spec.ts` | `tests/media-denial-clears-selection.test.ts` | newly executed |
| `tests/review-slot-withdrawal.spec.ts` | `tests/slot-availability-withdrawal.test.ts` | newly executed, plus the DST-offset row |
| `tests/review-viewer-selection.spec.ts` | `tests/viewer-lost-selection.test.ts` | newly executed; keeps the decorative rule (see below) |
| `tests/review-activity-denied-snapshot.{spec.ts,test.ts}` | **into `tests/activity.test.ts`** | duplicate of its denial test; the two inputs only it held — a cached row whose `occurredAt` is not an instant while `denied`, and the same row refused once the denial is lifted — are now a case there, which a later pin runs again across both loading phases in `tests/activity-denial-precedes-validation.test.ts` |
| `tests/review-family-contracts.test.ts` | **carried into five owners, file deleted** | see the carried rows below |
| `tests/review-shared-components.test.ts` | **carried into three owners + one new file** | see below |
| `tests/review-viewer-landscape.spec.ts` | `tests/viewer-landscape-orientation.spec.ts` | stays manual: needs `PLAYWRIGHT_MODULE`, which is not a dependency |
| `tests/review-viewer-reflow.spec.ts` | `tests/viewer-zoom-reflow.spec.ts` | same |
| `tests/screens/review-activity-directory-denial.test.tsx` | `tests/screens/activity-directory-denial.test.tsx` | |
| `tests/screens/review-activity-directory-recovery.test.tsx` | `tests/screens/activity-directory-recovery.test.tsx` | composed through `ResourceDetail`, unlike `useActivity.test.tsx` |
| `tests/screens/review-activity-obsolete-page.{test.tsx,spec.ts}` | `tests/screens/activity-obsolete-page-after-refusal.test.tsx` | dead shim deleted |
| `tests/screens/review-activity-obsolete-refusal.test.tsx` | `tests/screens/activity-obsolete-directory-refusal.test.tsx` | |
| `tests/screens/review-activity-paging-directory.{test.tsx,spec.ts}` | `tests/screens/activity-directory-paging-denial.test.tsx` | dead shim deleted |
| `tests/screens/review-activity-route-lifetime.{test.tsx,spec.ts}` | `tests/screens/activity-route-lifetime.test.tsx` | dead shim deleted |
| `tests/screens/review-activity-session-denial.test.tsx` | `tests/screens/activity-session-denial-detail.test.tsx` | |
| `tests/screens/review-viewer-denial.test.tsx` | `tests/screens/viewer-denial-abandons-loader.test.tsx` | |
| `tests/screens/review-viewer-lifetime.test.tsx` | `tests/screens/viewer-recovery-retains-loader.test.tsx` | |
| `tests/screens/review-viewer-removal.test.tsx` | `tests/screens/viewer-revoked-selection.test.tsx` | |
| `tests/ui/review-calendar-withdrawal.test.tsx` | `tests/ui/calendar-withdrawal.test.tsx` | |
| `tests/ui/review-cart-withdrawal.test.tsx` | `tests/ui/cart-withdrawal.test.tsx` | |
| `tests/ui/review-feedback.test.tsx` | **into `tests/ui/feedback.test.tsx`** | that file owns `StateView` and `Gallery` feedback; both cases moved whole, neither merged |
| `tests/ui/review-list-withdrawal.test.tsx` | `tests/ui/list-withdrawal.test.tsx` | |
| `tests/ui/review-map-withdrawal.test.tsx` | `tests/ui/map-withdrawal.test.tsx` | |
| `tests/ui/review-pricing-withdrawal.test.tsx` | `tests/ui/pricing-withdrawal.test.tsx` | |
| `tests/ui/review-shared-families.test.tsx` | `tests/ui/viewer-image-adapter.test.tsx` | its `PhotoViewer` case is not `shared-kit.test.tsx`'s `MediaHero` case |
| `tests/ui/review-slot-withdrawal.test.tsx` | `tests/ui/slot-withdrawal.test.tsx` | |
| `tests/ui/review-stepper-recovery.test.tsx` | `tests/ui/stepper-recovery.test.tsx` | |
| `tests/review-gallery-browser.case.mjs` | `tests/gallery-browser.case.mjs` | manual, undiscovered, as before |
| `tests/screens/review-native-map.case.tsx` | `tests/screens/native-map-marker.case.tsx` | manual, undiscovered, as before |
| `tests/ui/review-calendar-navigation.case.tsx` | `tests/ui/calendar-navigation.case.tsx` | manual, undiscovered, as before |

## Rows carried before a copy was deleted

`tests/review-family-contracts.test.ts` and `tests/review-shared-components.test.ts`
were copies of area owners. Each input no owner held moved to that owner first:

| Input only the copy had | Now asserted in |
| --- | --- |
| a slot's zone `offset` per row across a DST change (`["-04:00", "-05:00"]`) | `tests/slot-availability-withdrawal.test.ts` |
| `checkout.state: "busy"` disables checkout while the quote is live | `tests/cart-quote-withdrawal.test.ts` |
| a refused step transition whose message is Portuguese copy | `tests/stepper-pending-write.test.ts` |
| an event that ended before the viewed day (`minutes 1500`, `events.length 0`) | `tests/calendar-withdrawal.test.ts` |
| a negative `yDomain`, a null splitting the line into two segments | `tests/shared-kit.test.ts` |
| empty-cart total `"0"`, the `subtotal`/`total` pair, a line multiplication that overflows | `tests/shared-kit.test.ts` — its `total.currency` and input-unchanged assertions did **not** move with the data; see the lost blocks below |
| the whole nested copy-key walk, the frozen action list, the secondary-intent refusal in the caller's copy | `tests/feedback.test.ts` (the walk **replaces** the narrower `Object.keys(copy.state)` comparison, so the parity rule keeps one implementation) |
| every specified family has its public core factory | **new** `tests/core-component-families.test.ts` — no owner asserted the derive surface |

Three assertion blocks were deleted, each after the kept side was read line by line:

* removed-but-selected rows and the disabled bulk action — `tests/list-selection-withdrawal.test.ts:65-69` asserts the same three things;
* map provider failure retaining rows, the id it answers and `selectionIssue === undefined` —
  `tests/map-withdrawal.test.ts:51-62`; the `selectedId` line of that block is the third block below;
* the decorative-item block in `tests/shared-kit.test.ts` — `tests/viewer-lost-selection.test.ts:31-47` covers both causes and compares the whole `selectionIssue`.

The line-by-line read above missed three blocks that left a file with no owner. A review read the
deleted copies against the kept side and found them; all three are asserted again.

* `review-shared-components`' cart-totals case ended at its two minor-unit sums at head. The
  assertions that a cart total carries the cart's own currency, and that `cartTotals` leaves the
  lines its caller still holds alone, stayed in the deleted file. **new**
  `tests/cart-total-currency.test.ts` holds both from its own inputs (BRL; 275x4 + 1890 − 150), and
  fails when `cartTotals` builds money from a fixed currency or sorts the caller's `lines` in place.
* `review-activity-denied-snapshot`'s withdrawn-cached-trail case lost `more === undefined` and
  `pageError === undefined`: those two held at head only for the sibling input whose cached row was
  readable. They are back inside `tests/activity.test.ts`'s withdrawn-trail case, beside the input
  that needs them, and fail when a denied trail keeps its paging control or emits a page error.
* `review-family-contracts`' map case ended on `assert.equal(result.selectedId, "west")`. The kept
  side checked `rows.find(row => row.selected)?.id` — the *other* property the map model answers a
  drawer with, computed by matching each point against the caller's id — and the read counted that
  as the whole block. `tests/map-withdrawal.test.ts:51-62` asserts both now, and fails when
  `src/core/map.ts` answers `selectedId: undefined` while every row flag stays right: the two are
  one input, not one assertion, which is what the mutation run in that commit's body shows.

Nothing else left a file besides those three blocks. A machine pass over the three deleted copies
now says so: every property name an assertion of theirs reads (`assert.<x>(a.b` and its arguments)
appears somewhere in the owners that took that copy's cases, with one exception — `review-shared-components`'
`assert.deepEqual(derive.deriveState(input, first), before)` reads a namespace import, and the owner's
copy of the rule is the dotless `assert.deepEqual(deriveState(input, p), english)` in
`tests/feedback.test.ts`'s `C01:` case. Fixture titles that read "Review record 347" read
"Note 347"; the `T0180: ` prefix is gone from every title. Domain content a test
quotes — an activity verb of `Reviewed` — stays, because it is the server's word,
not this repository's history.

## Counts, same method in three trees: the specified base, the rebase point, head

The branch was rebased onto `741cb3a` after the fold was first measured, and that commit carries
another task's journeys work: 16 more root Node files, 3 more Jest suites, 8 more Jest cases. Every
figure in the middle and right columns was taken again in an export of `741cb3a`
(`git archive 741cb3a | tar -x -C "$STATE/rebase-base"`, `node_modules` symlinked from this
checkout) and here; nothing was carried over from the pre-rebase measurement, and no number moved to
make an arithmetic close — the fold's own deltas are still 27 cases leaving 10 files and 29
arriving in 17.

| | `31dc830`, the base SPECIFY measured | `741cb3a`, origin/main and the merge base now | head |
| --- | --- | --- | --- |
| `npm run test` Jest suites / tests | 46 / 232 | 49 / 240 | 48 / 240 (one suite moved into another) |
| `node --import tsx --test tests/*.test.ts` | 189 | 225 | 231 |
| root Node test files | 33 | 49 | 56 |
| review-named files (the gate's own regex over the tree) | 48 | 48 | **0** |
| `grep -rn "T0180" tests/` | 55 lines | 55 lines | no output |

## Coverage, per touched folder, same command in both trees

`741cb3a` — the merge base, so the comparison sees this branch's change and nothing else — was
exported with `git archive 741cb3a | tar -x -C "$STATE/rebase-base"` and given a symlink to this
checkout's `node_modules`; each command below ran once in that export and once here, with
`--coverageReporters=text-summary`. Statements / branches / functions / lines:

| Suites selected | base `741cb3a` | head |
| --- | --- | --- |
| `jest --coverage --testPathPattern 'tests/ui/'` | 75.81 / 68.32 / 70.86 / 78.73 (17 suites, 119 tests) | 75.81 / 68.32 / 70.86 / 78.73 (16 suites, 119 tests) |
| `… --testPathPattern 'tests/screens/'` | 41.60 / 34.26 / 32.91 / 43.11 (25 suites, 105 tests) | 41.60 / 34.26 / 32.91 / 43.11 (25 suites, 105 tests) |
| `… --testPathPattern 'tests/[^/]+\.test\.tsx$'` — the root's Jest half | 36.00 / 27.28 / 28.82 / 37.97 (7 suites, 16 tests) | 36.00 / 27.28 / 28.82 / 37.97 (7 suites, 16 tests) |
| `jest --coverage --coverageReporters=text-summary` — the whole suite | 79.32 / 70.43 / 73.89 / 82.13 (49 suites, 240 tests) | 79.32 / 70.43 / 73.89 / 82.13 (48 suites, 240 tests) |

No cell moved, which is what a rename should do to coverage. The one suite-count change (`tests/ui/`
17 → 16, tests still 119) is `review-feedback.test.tsx`'s two cases moving into
`tests/ui/feedback.test.tsx`. These figures are the rebase point's and do not match the ones first
taken at `31dc830` (78.66 / 70.19 / 73.13 / 81.48 over 46 suites, 232 tests): the trees differ by
the journeys work above, and a percentage is a property of a tree, not of this fold. The Node suite
has no coverage runner, which is why it reports the test count below instead of a second percentage.

## The Node count, case by case

Every root Node file was run on its own (`node --import tsx --test tests/<f>.test.ts`) in both
trees, so the arithmetic names every case rather than summarising it. Base `741cb3a`: **225 cases in
49 files**; head: **231 in 56 files**. Of the 225, 27 sat in the ten review-named `.test.ts` files;
six `.spec.ts` bodies held 7 more cases that no gate executed — the same six bodies, run on their
own in the export, answer 7 there and 7 at `31dc830`.

`225 − 27` (the review-named files' cases leave their names) `+ 29` (17 files that did not exist at
the base: 25 cases in the thirteen owners the fold renamed, 1 in each of the four files a review
added afterwards) `+ 4` (new cases inside three files that never moved: `activity.test.ts` +2,
`shared-kit.test.ts` +1, and `component-suite-gate.test.ts` +1 for the Node glob) `= 231`. The
39 files that kept their name kept their case count too, except those three, which is the whole
statement of what moved.

| Head file | Cases | Where its cases come from |
| --- | --- | --- |
| `activity-actor-snapshot.test.ts` | 2 | moved whole from `review-activity-directory-snapshot` |
| `activity-scope-isolation.test.ts` | 2 | moved whole from `review-activity-scope-isolation` |
| `activity-audit-snapshot.test.ts` | 2 | moved whole from `review-activity-withdrawal` |
| `calendar-withdrawal.test.ts` | 3 | 2 moved whole, + 1 overnight civil-day row from `review-family-contracts` |
| `map-withdrawal.test.ts` | 2 | moved whole from `review-map-withdrawal` |
| `pricing-withdrawal.test.ts` | 2 | moved whole from `review-pricing-withdrawal` |
| `stepper-pending-write.test.ts` | 3 | 2 moved whole, + 1 refused-transition-in-the-caller's-copy row |
| `cart-quote-withdrawal.test.ts` | 2 | 1 body no gate ran, + 1 busy-quote row from `review-family-contracts` |
| `slot-availability-withdrawal.test.ts` | 2 | 1 body no gate ran, + 1 DST `slot.offset` row |
| `list-selection-withdrawal.test.ts` | 1 | body that no gate ran |
| `viewer-snapshot-isolation.test.ts` | 1 | body that no gate ran |
| `viewer-lost-selection.test.ts` | 1 | body that no gate ran |
| `media-denial-clears-selection.test.ts` | 2 | body that no gate ran (two locales) |
| `core-component-families.test.ts` | 1 | new file — the one `review-shared-components` assertion with no owner |
| `cart-total-currency.test.ts` | 1 | new file after the review — the cart `currency` and untouched-input assertions the exact-total case lost when it became data |
| `test-file-first-comment.test.ts` | 1 | new file after the review — the first comment of the four merge targets |
| `activity-denial-precedes-validation.test.ts` | 1 | new file after the review — the two inputs `review-activity-denied-snapshot` held, run across both loading phases |
| `component-suite-gate.test.ts` 1 → 2 | +1 | the Node glob and the files it reaches, now pinned beside the Jest discovery it sits next to in `package.json` |
| `activity.test.ts` 6 → 8 | +2 | the two inputs only `review-activity-denied-snapshot` held; its own two cases were duplicates and were dropped. Its withdrawn-trail case also took back `more`/`pageError` for its own malformed-timestamp input, inside the case that already ran it |
| `shared-kit.test.ts` 14 → 15 | +1 | the negative-domain/null-split case; its empty-cart `"0"` and line-overflow rows joined the existing money case's data |

Eight of the 27 cases stopped existing as separate cases, each one checked against the kept side
line by line first. Four were pure duplicates: two `review-activity-denied-snapshot` copies of
`activity.test.ts`'s denial pair (its two unique inputs are the `+2` above), and two
`review-family-contracts` copies — removed-but-selected rows against
`tests/list-selection-withdrawal.test.ts:65-69`, map provider failure against
`tests/map-withdrawal.test.ts:51-62` — where one line of the deleted block had to come back, see
above. Four carried an input an owner lacked, so the input moved into
a case that already existed instead of becoming a new one: `review-shared-components`' locale
independence, nested copy-key walk (which widened the narrower comparison it joined) and
secondary-intent refusal into three `tests/feedback.test.ts` cases, and its exact-cart-total case
into `tests/shared-kit.test.ts`'s money case as data — as data only: two of that case's assertions
did not travel with it, and the `tests/cart-total-currency.test.ts` row above is where they live now.

## Every case of the three deleted copies, by both names

The table above maps files and counts, and the paragraphs around it count the names that stopped
existing. This one lists every case of the three copies that were deleted — `review-family-contracts`,
`review-shared-components`, `review-activity-denied-snapshot` — renamed, folded into a case or
duplicated alike, so each can be followed to the case that answers it now: the base name is one a
person can grep in `git show 31dc830:tests/<file>`, and the head name is what `npm run test` prints.
That is twelve cases. Four became inputs inside a case that already existed (`C01` twice, `C02` and
the exact-cart-total case); three were duplicates of lines named in their own row (the step writes,
the removed rows, the map case); one split between two owners (the overnight calendar half and the
chart-null half); and the rest carry an input no owner held into a case that exists under its own
name now (the busy quote, the Portuguese refusal, the component-family factories, the cart currency
pair, the loading-phase pair). The name-by-name comparison in "The same check by machine" below sees
ten of these twelve leave and nine arrive, because two are locale twins of a name the owner already
had and the component-family case keeps its words once the prefix is stripped.

| Base case, in this file | Asserted in this head case |
| --- | --- |
| `T0180: repeated civil times retain distinct availability identities and insufficient capacity refuses selection`, `tests/review-family-contracts.test.ts` | `a repeated civil time keeps its own offset and a slot over capacity cannot be selected`, `tests/slot-availability-withdrawal.test.ts` |
| `T0180: expired and busy quotes cannot expose checkout while a fresh quote echoes its revision`, same file | expired/fresh half: `a withdrawn cart quote cannot retain checkout and a fresh quote restores only its own revision`, `tests/cart-quote-withdrawal.test.ts`; the busy-quote input, which no owner held: `a quote still being written cannot be checked out even while it is live`, same file |
| `T0180: uncertain step writes expose reconciliation and refuse navigation without mutating the draft`, same file | duplicate of `pending step writes refuse every transition without returning or mutating a draft`, `tests/stepper-pending-write.test.ts`; its Portuguese refusal message, which no owner held, is the separate case `a refused step transition answers in the caller's copy and leaves the draft alone`, same file |
| `T0180: removed loaded rows cannot remain bulk-action targets`, same file | duplicate of `refreshed list eligibility cannot carry removed or disabled rows into a bulk target`, `tests/list-selection-withdrawal.test.ts:65-69` |
| `T0180: map provider failure retains every authorized list row and permits only explicit recovery`, same file | duplicate of `en`/`pt` `map withdrawal clears markers and selected records while provider failure keeps the authorized list`, `tests/map-withdrawal.test.ts:51-62` — with its `selectedId` line restored, which the first read left behind |
| `T0180: adjacent overnight calendar data and chart nulls preserve supplied boundaries`, same file | calendar half: `an event that ended before the viewed day leaves that day empty without moving its bounds`, `tests/calendar-withdrawal.test.ts`; chart half: `a series that dips below zero keeps its own bounds and a missing sample splits its line`, `tests/shared-kit.test.ts` |
| `T0180: every specified component family has its public core factory`, `tests/review-shared-components.test.ts` | `every specified component family has its public core factory`, **new** `tests/core-component-families.test.ts` — no owner asserted the derive surface |
| `T0180: invalid secondary recovery refuses the whole model in the caller's language`, same file | `C02: immutable and unknown writes refuse retry intents, including secondary controls`, `tests/feedback.test.ts` |
| `T0180: independent presentations retain their own locale, zone and copy`, same file | `C01: copy, locale and zone are explicit and independent between callers`, `tests/feedback.test.ts` |
| `T0180: English and Portuguese copy have the same complete nested keys`, same file | same `C01:` case: its whole-tree `paths()` comparison **replaces** the narrower `Object.keys(copy.state)` comparison it joined, so the parity rule keeps one implementation |
| `T0180: cart totals are exact, allow the empty cart and refuse overflow without a partial total`, same file | as data, `money is exact beyond Number, cancelling adjustments are order-independent, malformed money refuses`, `tests/shared-kit.test.ts`; the two assertions that did not travel with that data: `a cart total carries the cart's currency and leaves the caller's lines untouched`, **new** `tests/cart-total-currency.test.ts` |
| `T0180: ${language} denial withdraws a cached trail before validating or formatting it`, `tests/review-activity-denied-snapshot.spec.ts` | duplicate of `${language} denial withdraws a cached trail before validating or formatting it`, `tests/activity.test.ts` — same words after the prefix is stripped, so a name comparison cannot see it leave; its two unique inputs are the case that reads them (`tests/activity.test.ts:110` and `:142`) and `denial suppresses malformed cached activity and paging in either loading phase`, **new** `tests/activity-denial-precedes-validation.test.ts`, which holds the phase pair the owner does not vary |

`tests/ui/review-feedback.test.tsx`'s two cases are not rows here: they moved whole into
`tests/ui/feedback.test.tsx` under the same words — `the default gallery presents a translated
refusal for unsupported formatting %p` and `%s recovery stays blocked until current props make it
ready`, `199` and `212` of the head file — with only the `T0180: ` prefix gone, and no assertion was
folded into another case.

## What each file says about itself

Decision 0072 asks a reader to learn what a file protects from its name and first comment. Every
file in the table above that carried no comment at all — and every one this fold renamed, whether or
not it had one — now opens with two or three lines naming the rule it holds and what breaks without
it. Nothing else in those files moved.

Four files were left out of that by the fold itself: the merge targets `tests/activity.test.ts`,
`tests/feedback.test.ts`, `tests/shared-kit.test.ts` and `tests/ui/feedback.test.tsx` received other
files' cases and still opened with an import, so the acceptance a reader judges by name and first
comment alone was false for exactly the files where it mattered most. Each now opens with the rules
its own cases hold, and **new** `tests/test-file-first-comment.test.ts` pins the first non-blank line
of those four paths so the omission cannot come back quietly. It names those four and walks no other
file: it is a pin about this fold, not a linter for the tree.

Fixture identifiers written by the same review rounds moved with them, because they are names a
person greps: `review-cart` → `cart-surface`, `review-calendar` → `calendar-surface`,
`review-list` → `list-surface`, `review-map`/`-canvas`/`-detail-` → `map-surface`/`map-canvas`/
`map-detail-`, `review-pricing` → `pricing-surface`, `review-stepper`/`review-step-draft` →
`stepper-surface`/`step-draft-input`, and the `review-session` media scope → `viewer-session`. Every
one is set and read inside one test file; no component, flow or `e2e/flows` id refers to any of them
(`grep -rn "review-" e2e/` → empty before and after, and `npm run check:flows` still answers
“every id is a testID a component sets”).

The five files that hold more than one rule — `activity-audit-snapshot`,
`list-selection-withdrawal`, `map-withdrawal`, `media-denial-clears-selection`,
`pricing-withdrawal` — had their header rewritten after it was first written, because a
header that names one of three rules is a claim the file does not answer.

The two manual `.case.tsx` pins said “Deferred in review 2” and named the file's own old path. They
now say what they pin, why they are undiscovered (their assertion fails against the component today,
which is the component's question) and the exact command that runs them.

## Beyond the tool's list, because the shape was the same

`review_named.py` lists files by name, so four files carrying the exact shape this fold exists to
remove were not on its list. They are folded anyway, for the reason the listed ones were — one
discovery rule, `tests/**/*.test.ts(x)` for Jest and `tests/*.test.ts` for Node:

| From | To |
| --- | --- |
| `tests/session-load-order.spec.ts` (body) + `.test.ts` (1-line shim) | `tests/session-load-order.test.ts` |
| `tests/session-save-order.spec.ts` (body) + `.test.ts` (2-line shim) | `tests/session-save-order.test.ts` |
| `tests/advisory-filing-identity.spec.ts` (body) + `.test.ts` (1-line shim) | `tests/advisory-filing-identity.test.ts` |
| `tests/component-suite-gate.spec.ts` (body) + `.test.ts` (1-line shim) | `tests/component-suite-gate.test.ts` |
| `tests/screens/activity-directory-{pagination,read-order}.spec.ts` | deleted — a `.spec.ts` beside a discovered `.test.tsx` under `tests/screens/` runs nothing, and each held only `import "./x.test"` |

`grep -rn 'import "\./' tests/` now returns nothing: no test reaches another test file, and the three
`tests/*.spec.ts` bodies that stay are the browser pins, which run only by hand.

## The same check by machine, so no name vanished silently

Every case the tree executed at the merge base was listed — `node --import tsx --test tests/<f>.test.ts`
per root file, one run of the six `.spec.ts` bodies no gate globs, and `jest --verbose` — in the
exported `741cb3a`, which is this branch's merge base now; the same three lists were taken at head;
and the two were compared after removing the `T0180: ` prefix and the `en`/`pt` prefix each
locale-paired case carries. The same lists were first taken against `31dc830`, before the branch was
rebased; they were re-taken here rather than adjusted, which is why the numbers below are larger.

The comparison is a one-off measurement, so the rule it checked is pinned by machine as well: beside
the Jest discovery it already held, `tests/component-suite-gate.test.ts` now refuses a `test` script
that stopped globbing `tests/*.test.ts` with the loader flag, and any file that glob reaches which
holds no `test(` or `describe(` of its own — the one-line `import "./x.spec"` shim shape this fold
deleted, which is discovered, runs green and asserts nothing.

* **Jest: 240 cases in 49 suites at `741cb3a`, 240 in 48 suites at head; 212 distinct behaviours on
each side after stripping the `T0180: ` and the `en`/`pt`/`light`/`dark`/`day`/`week`/`agenda` prefix
each table-driven case carries.** Compared name by name: no base name is missing at head, no head
name is absent at base, and no name runs a different number of times on either side. Not one
component, screen or shell case was renamed away, dropped or run fewer times; the one suite that
disappears is `review-feedback.test.tsx`, whose two cases run inside `tests/ui/feedback.test.tsx`.
* **Node: the required check ran 225 cases at the base, and the six `.spec.ts` bodies no gate globs
  held 7 more — 232 executed, 223 distinct behaviours. Head runs 231, with 222 distinct names.** Ten
  base names have no head counterpart and nine head names have no base one, and no name runs fewer
  times at head than at base, which is the check that a case did not dissolve inside a rename. The
  ten are all cases of the three deleted copies, and each is answered by name in the table above:
  five reappear under a new name (the repeated civil time, the overnight civil day, the
  negative-domain series, the busy quote and the refused step transition), four became inputs inside
  a case that already existed (`C01`, `C02`, the nested copy-key walk and the exact-cart-total case),
  and one (`map provider failure retains every authorized list row and permits only explicit
  recovery`) was a duplicate whose `selectedId` line had to come back into its owner. Of the nine new
  names, five are those renamed cases, three are pins a review added afterwards (`a cart total
carries the cart's currency and leaves the caller's lines untouched`, `a test file states the rules it
holds before it imports` and `the Node suite still runs by the glob its counts were taken from, over
files that hold cases`) and one is the denial pin (`denial suppresses malformed cached activity and
paging in either loading phase`). A further two cases at the base — `review-activity-denied-snapshot`'
— shared their names verbatim with `activity.test.ts`, so a name comparison cannot see them leave and
only the line-by-line read above can: their two unique inputs are cases there and in the denial pin.
Nothing else differs.

## Left as it was, on purpose

* The `C01:`/`C02:`/`C03:` prefixes in `tests/feedback.test.ts` are not review numbering: they name
  conformance cases of the shared specification
  (`docs/shared-mobile-components.md:1138-1145`), and a test title that cites them says which
  requirement it answers. They stay.
* `tests/ui/calendar-navigation.case.tsx` and `tests/screens/native-map-marker.case.tsx`
  fail when run by hand at the merge base. They stay undiscovered: making them
  discovered would turn `npm run check` red on a production question, and whether
  the failure is a bug or a wrong expectation is a separate decision.
* The three `PLAYWRIGHT_MODULE` pins — `tests/viewer-landscape-orientation.spec.ts`,
  `tests/viewer-zoom-reflow.spec.ts` and the behaviour-named
  `tests/viewer-controls.spec.ts` — stay manual: playwright is not a dependency here, and
  installing a browser driver is not this fold's call.
