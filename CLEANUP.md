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
| empty-cart total `"0"`, the `subtotal`/`total` pair, a line multiplication that overflows | `tests/shared-kit.test.ts` |
| the whole nested copy-key walk, the frozen action list, the secondary-intent refusal in the caller's copy | `tests/feedback.test.ts` (the walk **replaces** the narrower `Object.keys(copy.state)` comparison, so the parity rule keeps one implementation) |
| every specified family has its public core factory | **new** `tests/core-component-families.test.ts` — no owner asserted the derive surface |

Three assertion blocks were deleted, each after the kept side was read line by line:

* removed-but-selected rows and the disabled bulk action — `tests/list-selection-withdrawal.test.ts:65-69` asserts the same three things;
* map provider failure retaining rows, selection and `selectionIssue === undefined` — `tests/map-withdrawal.test.ts:48-55`;
* the decorative-item block in `tests/shared-kit.test.ts` — `tests/viewer-lost-selection.test.ts:31-47` covers both causes and compares the whole `selectionIssue`.

Nothing else left a file. Fixture titles that read "Review record 347" read
"Note 347"; the `T0180: ` prefix is gone from every title. Domain content a test
quotes — an activity verb of `Reviewed` — stays, because it is the server's word,
not this repository's history.

## Counts, same method at `31dc830` and at head

| | base | head |
| --- | --- | --- |
| `npm run test` Jest suites / tests | 46 / 232 | 45 / 232 (one suite moved into another) |
| `node --import tsx --test tests/*.test.ts` | 189 | 191 |
| review-named files (`pillars.REVIEW_NAMED` over `git ls-files`) | 48 | **0** |
| `grep -rn "T0180" tests/` | 55 lines | no output |

The Node count rises by two because six `.spec.ts` bodies that executed in no gate
now do, six family-contract cases were folded into their owners, and eight carried
cases were added. `npx jest --coverage --coverageReporters=text-summary` at head
repeats the merge base exactly — 78.66 % statements (2364/3005), 70.19 % branches
(2216/3157), 73.13 % functions (675/923), 81.48 % lines (2148/2636) over 45 suites
and 232 tests — which is what a rename should do to coverage: nothing. The Node
suite has no coverage runner, which is why it reports the test count above instead
of a second percentage.

## Left as it was, on purpose

* `tests/screens/activity-directory-{pagination,read-order}.spec.ts` and
  `tests/viewer-controls.spec.ts` are dead shims and an unexecuted body with the
  same disease, but they are behaviour-named, so `review_named.py` does not list
  them and this fold leaves them for a round that owns them.
* The `C01:`/`C02:`/`C03:` case-id prefixes in `tests/feedback.test.ts` and
  `tests/shared-kit.test.ts` predate this task and survived in behaviour-named files.
* `tests/ui/calendar-navigation.case.tsx` and `tests/screens/native-map-marker.case.tsx`
  fail when run by hand at the merge base. They stay undiscovered: making them
  discovered would turn `npm run check` red on a production question, and whether
  the failure is a bug or a wrong expectation is a separate decision.
* The two `PLAYWRIGHT_MODULE` pins stay manual for the same reason — playwright is
  not a dependency here, and installing a browser driver is not this fold's call.
