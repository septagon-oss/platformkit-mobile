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
| `tests/review-activity-denied-snapshot.{spec.ts,test.ts}` | **into `tests/activity.test.ts`** | duplicate of its denial test; the two inputs only it held — a cached row whose `occurredAt` is not an instant while `denied`, and the same row refused once the denial is lifted — are now a case there |
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
* map provider failure retaining rows, selection and `selectionIssue === undefined` — `tests/map-withdrawal.test.ts:48-55`;
* the decorative-item block in `tests/shared-kit.test.ts` — `tests/viewer-lost-selection.test.ts:31-47` covers both causes and compares the whole `selectionIssue`.

The line-by-line read above missed two blocks that left a file with no owner. A review read the
deleted copies against the kept side and found them; both are named tests again.

* `review-shared-components`' cart-totals case ended at its two minor-unit sums at head. The
  assertions that a cart total carries the cart's own currency, and that `cartTotals` leaves the
  lines its caller still holds alone, stayed in the deleted file. **new**
  `tests/cart-total-currency.test.ts` holds both from its own inputs (BRL; 275x4 + 1890 − 150), and
  fails when `cartTotals` builds money from a fixed currency or sorts the caller's `lines` in place.
* `review-activity-denied-snapshot`'s withdrawn-cached-trail case lost `more === undefined` and
  `pageError === undefined`: those two held at head only for the sibling input whose cached row was
  readable. They are back inside `tests/activity.test.ts`'s withdrawn-trail case, beside the input
  that needs them, and fail when a denied trail keeps its paging control or emits a page error.

Nothing else left a file. Fixture titles that read "Review record 347" read
"Note 347"; the `T0180: ` prefix is gone from every title. Domain content a test
quotes — an activity verb of `Reviewed` — stays, because it is the server's word,
not this repository's history.

## Counts, same method at `31dc830` and at head

| | base | head |
| --- | --- | --- |
| `npm run test` Jest suites / tests | 46 / 232 | 45 / 232 (one suite moved into another) |
| `node --import tsx --test tests/*.test.ts` | 189 | 193 (191 from the fold, + 2 pins a review added) |
| root Node test files | 33 | 39 (37 from the fold, + the two review pins) |
| review-named files (`pillars.REVIEW_NAMED` over `git ls-files`) | 48 | **0** |
| `grep -rn "T0180" tests/` | 55 lines | no output |

## Coverage, per touched folder, same command in both trees

`31dc830` was exported with `git archive 31dc830 | tar -x -C "$TMPDIR/base-31dc830"` and given a
symlink to this checkout's `node_modules`; each command below ran once in that export and once here.
Statements / branches / functions / lines from Jest's own `All files` row:

| Suites selected | base | head |
| --- | --- | --- |
| `npx jest --coverage --coverageReporters=text --testPathPattern 'tests/ui/'` | 75.89 / 68.51 / 71.16 / 78.83 (17 suites, 119 tests) | 75.89 / 68.51 / 71.16 / 78.83 (16 suites, 119 tests) |
| `… --testPathPattern 'tests/screens/'` | 40.39 / 33.15 / 31.59 / 41.88 (22 suites, 97 tests) | 40.39 / 33.15 / 31.59 / 41.88 (22 suites, 97 tests) |
| `… --testPathPattern 'tests/[^/]+\.test\.tsx$'` — the root's Jest half | 36.09 / 27.41 / 28.95 / 38.07 (7 suites, 16 tests) | 36.09 / 27.41 / 28.95 / 38.07 (7 suites, 16 tests) |
| `npx jest --coverage --coverageReporters=text-summary` — the whole suite | 78.66 / 70.19 / 73.13 / 81.48 (46 suites, 232 tests) | 78.66 / 70.19 / 73.13 / 81.48 (45 suites, 232 tests) |

No cell moved, which is what a rename should do to coverage — the whole-suite row was re-run at this
head and reads the same, 78.66 / 70.19 / 73.13 / 81.48 over 45 suites and 232 tests, because both
pins added after the review are Node cases and Jest's count and coverage cannot move. The one
suite-count change (`tests/ui/` 17 → 16, tests still 119) is `review-feedback.test.tsx`'s two cases
moving into `tests/ui/feedback.test.tsx`. The Node suite has no coverage runner, which is why it
reports the test count above instead of a second percentage.

## The Node count, case by case

Every root Node file was run on its own (`node --import tsx --test tests/<f>.test.ts`) in both
trees, so the arithmetic names every case rather than summarising it. Base: 189 in 33 files; the
fold left 191 in 37 files; the two review pins take head to 193 in 39 files. Of the 189, 27 sat in
the ten review-named files; six `.spec.ts` bodies held 7 more cases that no gate executed.

`189 − 27` (the review-named files' cases leave their names) `+ 26` (the same cases under their new
names, plus what was carried to them) `+ 3` (new cases inside two files that never moved) `= 191`
`+ 2` (the two pins named below, one case each) `= 193`.

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
| `activity.test.ts` 6 → 8 | +2 | the two inputs only `review-activity-denied-snapshot` held; its own two cases were duplicates and were dropped. Its withdrawn-trail case also took back `more`/`pageError` for its own malformed-timestamp input, inside the case that already ran it |
| `shared-kit.test.ts` 14 → 15 | +1 | the negative-domain/null-split case; its empty-cart `"0"` and line-overflow rows joined the existing money case's data |

Eight of the 27 cases stopped existing as separate cases, each one checked against the kept side
line by line first. Four were pure duplicates: two `review-activity-denied-snapshot` copies of
`activity.test.ts`'s denial pair (its two unique inputs are the `+2` above), and two
`review-family-contracts` copies — removed-but-selected rows against
`tests/list-selection-withdrawal.test.ts:65-69`, map provider failure against
`tests/map-withdrawal.test.ts:48-55`. Four carried an input an owner lacked, so the input moved into
a case that already existed instead of becoming a new one: `review-shared-components`' locale
independence, nested copy-key walk (which widened the narrower comparison it joined) and
secondary-intent refusal into three `tests/feedback.test.ts` cases, and its exact-cart-total case
into `tests/shared-kit.test.ts`'s money case as data — as data only: two of that case's assertions
did not travel with it, and the `tests/cart-total-currency.test.ts` row above is where they live now.

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
per root file plus one run of the six `.spec.ts` bodies no gate globs, and `npx jest --verbose` — in
the exported `31dc830`; the same lists were taken at head; and the two were compared after removing
the `T0180: ` prefix and the `en`/`pt` prefix each locale-paired case carries:

* **Jest: 232 cases at base, 232 at head; 169 distinct behaviours after stripping the `T0180: ` and
  the `en`/`pt`/`light`/`dark`/`day`/`week`/`agenda` prefixes each table-driven case carries — equal
  on both sides, name by name and count by count.** Not one component, screen or shell case was
  renamed away, dropped or run fewer times.
* **Node: the required check ran 189 cases at the merge base, and the six `.spec.ts` bodies no gate
  ran held 7 more — 196 executed, 187 distinct behaviours. The fold left 191 and 182; head now runs
  193 and 184** (the two review pins, one case and one new name each). Ten names
  stopped being separate cases and five new ones appeared; **no name runs fewer times at head than
  at base**, which is the check that a case did not dissolve inside a rename. The ten are accounted
  for above: four reappear under a new name here — the overnight civil day and the negative-domain
  series (one base case split between its two owners), the busy quote, the repeated civil time and
  the refused step transition — four became inputs inside a case that already existed (`C01`, `C02`,
  the nested copy-key walk, the exact-cart-total case), and two were duplicates cited to the file and
  lines that cover them. A further two cases at base (`review-activity-denied-snapshot`) shared their
  names verbatim with `activity.test.ts`, so a name comparison cannot see them leave and only the
  line-by-line read above can: their two unique inputs are now cases there. The head side of this
  comparison was re-taken after the two pins landed (`node --import tsx --test --test-reporter=tap
  tests/*.test.ts`, names stripped of `T0180: ` and the `en`/`pt` prefix, then counted): 193 lines,
  184 distinct, the extra two being `a cart total carries the cart's currency and leaves the caller's
  lines untouched` and `a test file states the rules it holds before it imports`. The base side is as
  measured in the exported `31dc830`, which this fix did not rebuild. Nothing else differs.

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
