# Review deck: state machine and thresholds

This is a specification, not a description of shipped behavior. Review is a
generic reading of an entry's declared queue and commands. The product chooses
the queue, directions and domain rules; the phone owns the finite review pass,
input, feedback and recovery described here.

## Contract and provenance

The inspected mobile baseline is `fb2be883b0cd5013cc0723035b9b89e5f3c16c5d`.
Its API fixture pins `aa35944f576e143190ea67ba12bf812dd1b4cc0c`, before decks.
Implementation must first refresh `testdata/openapi.json` and its provenance to
kernel `5f993d8ca10ae3f15de18a30547ae8ee369a3222`, then run the existing
`npm run api` recipe. That target's fixture SHA-256 is
`e9256fc6aa4212e51246de379568cc546453a3865ec835cfa3e854be0fe7ffdc`.
The design-token fixture has separate provenance and is not refreshed for this.

The target's owners are
[`DeckHints` and `DeckFault`](https://github.com/septagon-oss/platformkit/blob/5f993d8ca10ae3f15de18a30547ae8ee369a3222/kit/entity/deck.go),
[`CheckRowHints`](https://github.com/septagon-oss/platformkit/blob/5f993d8ca10ae3f15de18a30547ae8ee369a3222/kit/httpx/row_hints.go),
and the authorized
[`DeckPresentation`](https://github.com/septagon-oss/platformkit/blob/5f993d8ca10ae3f15de18a30547ae8ee369a3222/ui/screens/hints.go).
Catalogue version 3 remains supported. No new HTTP endpoint, server entity,
permission, module, SQL migration or registry is proposed.

| Member | Mobile reading |
| --- | --- |
| `presentation.deck` absent or null | Ordinary list; no Review control or deck gestures. |
| `queue` absent or null | All rows of this entry. Otherwise repeated equality filters, each `field:value`, split at the first colon; values may contain further colons. Names must resolve to supported scalar fields. Preserve values verbatim for server coercion/domain validation; an empty string is not automatically invalid for a string field. An explicitly empty array is invalid, matching the declaration gate. |
| `order` | Required field name, with optional single leading `-` for descending. It must name a visible scalar in the entry's explicitly declared `sortable` fields. No local secondary sort is invented. |
| `directions` | Required object with only `left`, `down`, `up`, `right` keys. An empty object is valid: authorization can remove every command. |
| Command direction | Nonblank `command` and `label`, valid declared `tone` and `icon`, and no true `skip`. The verb resolves to this entry's authorized, person-facing, record command. It has no arguments or every argument has an explicit nonempty default. Omitted input invokes the server's defaults; the phone sends no invented argument values or empty object. |
| Local skip | Only `down: {skip: true}`; no command, label, tone or icon. Its label is kit copy “Review later”, tone neutral, icon `clock`. It sends no request. |

The generated schemas retain wire-shape ownership. Extend `hintEntry` in
`src/core/catalog.ts` to normalize the supported deck once, including references
to this entry's fields and commands. A malformed deck loses the entire deck hint
and reports its path through the existing hint-notice mechanism; the resource
keeps its ordinary list and commands. Missing directions are not filled in.
Unknown properties do not grant a capability. In particular, the target has no
`undoable` declaration, undo token or undo endpoint. A command answer is a row,
not permission to run an inverse command.

The generic phone does not duplicate the server's domain validation or interpret
a command's name as eligibility. A valid default's domain meaning remains the
server's responsibility. A malformed or unsupported catalogue as a whole keeps
the existing catalogue refusal behavior rather than becoming an empty deck.

## Deliverables and reuse

Every implementation deliverable has one owner from the trace's inventory:

| Deliverable | Reuse decision |
| --- | --- |
| API adoption | *composed from* `scripts/api.ts`, `scripts/api-config.ts` and the existing public fixture/provenance; regenerate rather than edit generated source. |
| Normalized deck and card model | *composed from* `src/core/catalog.ts` and `src/core/derive.ts`: existing labels, `listRow`, status, summary facts and cover/thumbnail selection. |
| Review session reducer | *new, because* the inventory found no deck session machine; it lives in `src/core/`, takes explicit events and returns state/effect intents without importing UI or effects. |
| Four-direction gesture reading | *composed from* `src/core/gesture.ts`'s pure, worklet-safe boundary; add the four-direction arithmetic there and preserve the existing one-axis `readSwipe` behavior. |
| Queue count and capture | *composed from* `Api.list`, `Window`, `listQuery` and `useResourceList`'s generation-guard pattern; no queue transport or read-cache implementation. |
| Command result and confirmation | *composed from* `src/screens/useCommand.ts`, `commandWording`, `commandOf`, `Outbox.submit` and `refusalOf`; expose accepted/refused/held/unknown outcomes through the existing sender instead of a second send path. Existing callers keep their presentation adapters. |
| Route and effect ownership | *composed from* `ResourceRoute`, `Renderer`, `MediaRenderers` and shell session/write ownership; add a declared deck screen kind and native deck-motion slot through those existing objects. |
| Deck screen and still stack | *new, because* no deck screen, hook or three-card stack exists; one screen hook owns reads/submission phase, one screen composition sets the header, one props-only organism draws the derived model. |
| Card, controls and notices | *composed from* `MediaHero`/`RecordCover` picture treatment, `ActionBar`, `ActionControl`, `Button`, `Badge`, `Icon`, `Text`, `Notice`, `Skeleton`, and `Screen`'s canvas/insets. Add any new atom/molecule to the existing Gallery. |
| Progress and finishing | *composed from* `deriveMeter`, `ProgressMeter`, `useFeedback` and the supplied `FinishingMotion`; the new session machine supplies the truthful queue-end trigger. |
| Copy and styling | *composed from* `src/core/copy.ts`/`kitCopy.ts`, theme and `src/ui/scale.ts`; no alternate palette or copy bundle. |
| Conformance driver | *composed from* `tests/fakes/shell.ts`, `tests/fakes/store.ts`, `tests/fakes/router.ts`, `tests/fakes/presentation.ts` and the distance-driven pattern in `tests/fakes/gesture.tsx`; extend that driver to call the production deck arithmetic and session decision, not reimplement them. |
| Device journey and evidence | *composed from* `e2e/flows/list.yaml`, `verb.yaml`, the existing flow-ID checker, test inventory and `make e2e-android`; add the missing deck journey to that harness. |
| Specification | *composed from* the README's ownership/verification/limits and existing `docs/` rationale format; this document adds the missing state and threshold contract. |

The generated screen kind is `deck`, addressed by the extended core
`address("deck", entry)` as `screenPath(entry) + "/review"`. Its route composes
`ResourceRoute` only, and `Renderer.deck` remains an optional override in the
existing renderer pack. `MediaRenderers` supplies the optional native stack
surface. The generated organism remains usable with no override or motion slot.

## Queue, identity and session data

Review appears in the list toolbar as “Review {n}”. The count is a successful
live `Api.list` response's `total` for exactly the deck's filters and order,
independent of the ordinary list's current filters, sort and loaded-row count.
Reuse a list response only when that query matches. Otherwise read one row of the
declared queue to obtain its total; there is no invented count endpoint. During a
count read show the loading affordance; on failure show a classified notice and
Retry, never substitute the ordinary list's total. At zero show “Review 0”
disabled. With no authorized direction, show the count disabled and the
localized explanation “No review actions are available.” A skip-only deck is
enabled. A deep link also checks these conditions through the same core model.

A **session** starts when a person opens Review and ends on leaving that route,
sign-out/expiry, server or person change, or replacement of its entry's deck
declaration. Opening a record suspends this session until return; a normal
background/foreground cycle preserves it. Reopening Review creates a new
session. Bind it to the shell's actual server/person/session generation and
resource `key(entry)`; the client has no independent tenant identifier to invent.
Every read, confirmation answer, command outcome and animation callback also
carries its session generation and operation ID. Only a matching pending
operation may settle. State is per session, never global across people.

The session's fields and their consumers are:

| Field | Meaning and reader |
| --- | --- |
| Binding and generation | Identity above plus the normalized deck, its resolved commands and the entry's list/read capabilities; compare their values, not object references. Equivalent catalogue reloads preserve the session; changed values (including localized declaration copy) end it. The reducer rejects obsolete events. |
| Phase | One state from the table below; derivation decides visible controls and busy state. |
| Capture | Purpose (initial or revalidation), initial count `N`, raw next offset, and first-seen rows keyed by record ID; the hook drives the finite reads. Retain purpose across a read failure; discard capture when complete. |
| Roster and active order | Unique IDs and last observed row values in initial encounter order; the top and next two active cards are derived from this order. |
| Deferred order | IDs skipped in this pass, in skip order, at the tail after active IDs; rewind removes the last skipped ID from it. |
| History | Ordered completed choices `{recordID, direction, kind: command or skip}`; only its last entry decides whether Rewind exists. Counts and completed progress are derived from it, never separately incremented state. |
| Pending intent | Current record ID, direction, operation ID and, only for a held result, the existing outbox item ID; locks all further choices until settled. |
| Blocked intents | Record/direction pairs that received an immutable command refusal; choice guards consult them until successful revalidation. A missing target blocks every direction for that ID. |
| Notice | Classified failure/recovery for the current card or read, derived into visible and spoken copy. |
| Encouragement shown; finishing played | Monotonic per-session flags; prevent repeated encouragement or burst after rewind, render, or end-count Retry. |

Record IDs are required nonempty strings from the existing row identity. A
missing ID or invalid nonnegative safe-integer total fails capture; do not create
a local synthetic identity or silently label malformed data empty.

### Finite capture and concurrent changes

Before enabling the first card, capture the queue's row metadata through
sequential list windows. The first live page fixes the scan bound `N = total`.
Use the existing `PER_PAGE`; after each page advance by its **raw items length**,
not its deduplicated length. Request at most the remaining `N - offset` rows.
Stop at that bound or the first empty page. Retain each ID only at its first
encounter, with that occurrence's row and position. No command runs during
capture. Load pictures only for the three visible cards through `usePictures`.
A failed capture Retry discards the partial capture and starts from offset zero.

The captured unique roster size `M`, rather than a stale toolbar count, is the
pass denominator. A changed page total, duplicate ID or early empty page shows
“The queue changed. Reviewing the items loaded.” No padding, hidden 200-row cap,
or loop waiting for the queue to become stable is allowed. Example: `N=23`, page
one has 20 IDs, the next request is offset 20 / limit 3; if it returns one
duplicate and two new IDs, `M=22`. Own commands cannot make subsequent offsets
skip rows because capture has already finished.

This is a bounded observation, **not a transactional snapshot**: offset pages can
miss or duplicate rows under concurrent inserts, deletes, reordering or tied
sort values, even when totals stay equal. First encounter defines the pass's
order. New or unobserved rows belong to the next pass. No client-side algorithm
can infer snapshot consistency from this contract. A final live queue read is
therefore required before saying that the queue is empty.

Skip appends the top ID to the deferred tail, moves to the next active ID and
performs no network write. A deferred card is not automatically presented again
in this pass. This gives “later” a finite meaning, including for a skip-only
deck; leaving and reopening starts another server-ordered pass. Skip order and
rewind are local session state, not a durable server reorder.

Progress is completed choices in history, including skips, out of `M`: initial
`0 of M`, after seven choices `7 of M`. Refusal, confirmation, held/unknown
outcomes and animation do not count. Rewinding a skip removes its history entry
and decrements progress and its direction count together. At `M=0` there is no
fraction or progress bar. After the first transition to five completed choices,
show one encouraging line; rewinding below five does not reset that flag.
At every settled state, `M = history.length + active.length`; deferred IDs already
have a history entry and are not counted twice. Successful revalidation can
reduce `M` only by removing an active ID, never by subtracting completed work.

## Deck state machine

`choose(direction)` below is shorthand for an event carrying the direction,
expected top ID and session generation. A valid gesture release, its button and
its named accessibility action all capture those facts from the same model.
A stale input cannot apply its choice to a newer top card. Guards resolve the
**current** normalized
direction and current top ID, excluding blocked intents and records with an
unresolved existing outbox item; event payloads cannot supply an arbitrary verb.
State is locked synchronously before any asynchronous confirmation or send.
Normal animations may delay input but never determine command success.

| State | Event and guard | Next state and visible result | Effects / history |
| --- | --- | --- | --- |
| closed | Open, live session, valid deck, at least one authorized direction | loading | Capture offset zero. History/flags empty. An empty queue is allowed on a deep link. |
| loading | Matching page, more within scan bound | loading | Append first-seen IDs, request next raw offset; no decisions. |
| loading | Capture/revalidation completes with an unresolved outbox item for its next active ID | held, or unknown if that item is unknown | Show that existing item's state and ID; no new intent. This guard takes precedence over enabling ready. |
| loading | Matching initial capture completes, `M > 0` | ready | Derive top plus at most two rear cards; `0 of M`. |
| loading | Matching initial capture completes, `M = 0` | checking | Read live queue total; no fabricated card or fraction. |
| loading | Matching revalidation completes | ready if active IDs remain, otherwise checking | Apply the revalidation rule below, preserving history/flags. Successful revalidation clears blocked intents; current declaration and outbox guards still apply. |
| loading | Read failure | read-error, with no partial actionable cards | Classified read notice. Correctable failure offers Retry from zero; immutable failure offers its exit. |
| read-error | Retry and failure is correctable | loading | Fresh capture; no replayed write. |
| ready / pass-end | Explicit Refresh, or read Retry after a definitive command refusal; no pending write | loading | Revalidate the existing roster from offset zero. Do not retry the command. |
| ready | One-pointer drag begins with valid measured geometry | dragging, same top ID | Capture geometry and reset this drag's tick flag. |
| dragging | Position update | dragging | Read candidate, armed flag, label opacity and tilt from the one core rule. At most one threshold tick. |
| dragging | Successful release, currently armed and direction still authorized | Same dispatch as `choose(direction)` below | Re-read at release, with captured top ID/generation; no action on crossing alone. |
| dragging | Short release, cancel, failed recognition, extra pointer or geometry changed | settling, same top ID | Spring to rest, or reduced-motion still state. No history or command. |
| ready / dragging | `choose(d)`, declared local skip | settling, next active card or no active card | Append one skip history entry and deferred ID. Fly off or cross-fade. No POST, shell write increment, success receipt or success haptic. |
| ready / dragging | `choose(d)`, command requiring declared destructive/consequence confirmation | confirming, current card centered | Existing confirmation wording/control. No request/history until confirmation. |
| confirming | Cancel/dismiss | settling, same card | No request/history; restore focus to the originating control/card. |
| confirming | Confirm; binding, top ID and declaration still match | submitting, current card reserved | Send once through shared sender/outbox. No progress change yet. |
| ready / dragging | `choose(d)`, other valid command | submitting, current card reserved | Same single send. Speculative fly-off is allowed, but next-card controls stay locked. |
| submitting | Matching validated accepted row | settling, next active card or no active card | Append exactly one command choice; remove active top. Shared sender calls shell `wrote` and confirmed-write feedback once. Never credit the row's later disappearance as another acceptance. |
| submitting | Matching definitive refusal | settling, same card restored; then ready with reason under it | No history, write count, receipt or success haptic. Correctable refusal permits a fresh choice after correction; immutable refusal disables that intent and offers the classified exit/refresh. |
| submitting | Matching `{sent:false,item}` result | held, same centered card with holding notice | Keep outbox item ID; no count or second submission. Use existing held-write controls. |
| submitting | Timeout, lost/unreadable response, ambiguous failure or post-send cancellation | unknown, same centered card with uncertainty notice | No history, success feedback, retry button or automatic resend by the deck. Existing outbox uncertainty policy remains its owner. |
| held | Existing outbox reports refused | held with classified refusal, same card | No count. Resolve/discard the held item through its owner before making a new intent for that record. |
| held | Existing outbox reports unknown | unknown, same card | No count or additional send; its existing uncertainty controls remain authoritative. Queued/sending updates otherwise keep the held lock. |
| held | Item disappears, is discarded, or is otherwise resolved without a direct validated acceptance for this operation | closed / restart offered | Do not infer acceptance from disappearance: sent and discarded both remove an item. A new pass reads current server state. |
| held / unknown | Leave / restart after using existing held-write or reconciliation flow | closed, then new session if reopened | No replay by this session. If a matching held write still exists, the new deck cannot offer another intent for its record. |
| ready / pass-end | Rewind; last completed choice is a local skip still in deferred order and no pending write | settling, skipped card restored on top, former active top behind it | Pop one history entry and remove that ID from deferred tail. All other order stays. No HTTP or shell write count. |
| ready / pass-end | Rewind without a last local skip | Same state | Rewind is absent; forged action is refused without effects. No command undo in this target. |
| settling | Matching animation completion, active cards remain | ready | Enable controls. Reduced-motion/no-motion-slot completion follows the same event. |
| settling | Matching animation completion, no active cards remain | checking | Live queue-total read with offset zero and limit one, same declared query. |
| settling | Visual transition cancelled or unavailable | Same completion dispatch as above | The renderer finalizes once, including when reduced motion changes. Never strand an input lock or undo an accepted command because motion stopped. |
| checking | Matching live total is zero | caught-up, “All caught up” and per-direction counts | Play supplied finishing renderer once only if at least one command was confirmed in this session; an initially empty read never celebrates. |
| checking | Matching live total is positive | pass-end, “Review complete” and counts including “left for later” | No queue-empty claim or finishing burst. Offer Back to list; another Review opens a new pass. Rewind remains possible for a last skip. |
| checking | Read fails transiently | pass-end with “Couldn't check the queue. Try again.” | Preserve counts/rewind. Retry repeats the read only, never a decision or finishing effect. |
| checking | Read denies access, reports missing resource, or session expires | withdrawn or closed, according to the existing classifier/shell | Remove protected cards and controls. No success claim. |
| caught-up / pass-end | Leave | closed | Discard roster/history; commands already sent remain the server/outbox's concern. |
| ready | Open record by tap or accessible activate | suspended | Existing detail route, no decision; retain local session in memory. |
| suspended | Return with same identity/declaration | loading | Re-read the bounded queue; retain only captured roster IDs still observed, updating their rows. Exclude newly arriving IDs. If capture cannot complete, show read-error rather than allow stale actions. |
| any live state | Session/person/server changes, entry/deck withdrawn, or list/read grant removed | closed / withdrawn | Invalidate generation, cancel gestures and reads, clear card/history data; shell owns sign-in/re-entry. Re-entry starts a fresh pass and never replays a choice. |
| any | Obsolete callback; repeated release/press while locked; unknown action | Same state | No request, count, tick, navigation or finishing. Cancellation/obsolete responses are not server refusals. |

On return from a record, IDs no longer observed in the queue leave the **active**
roster without adding a choice. Reduce `M` by that number and say “The queue
changed. Reviewing the items loaded.” Completed history and deferred IDs keep
their meaning; never convert an external write into this person's direction
count. If a skipped card is no longer observed, remove it from deferred order
without deleting its already-recorded skip count; the rewind guard can no longer
restore it. During this
revalidation all writes/rewinds are locked. Retry restarts this read, not a new
decision. Returning while a command/held/unknown outcome is unresolved does not
unlock or recount it. Revalidation is not an assertion of atomic membership.

For all inputs outside the table's allowed state/guard, the reducer preserves
state and emits no effect. A callback can settle once only. Leaving while a POST
is outstanding does not prove that it was cancelled before commit: shell write
invalidation may still be filed for the same active identity, but a late result
cannot restore an old session's card, count, focus or celebration in another one.

### Refusals and recovery

“Correctable” means a stated read/input/environment correction permits a new
attempt. “Immutable” means the rejected intent cannot be repeated under its
current authority or contract; another identity, installation change or new
application version is a new context. None of these refusals records a choice.
Use the existing failure classifier; do not display arbitrary server `detail`
as a new unlocalized reason. A no-input command with field errors needs its
classified command-failed fallback under the card, since it has no field controls.

| Refusal | Classification beside the refusal | Recovery / data retained |
| --- | --- | --- |
| Invalid deck shape, unknown direction/verb, collection/system command, missing default, invalid order/filter or unsupported vocabulary | **Immutable for this declaration** | Suppress Review, retain ordinary resource; publisher corrects catalogue. No send. |
| No declared/authorized action; forged direction or command rewind | **Immutable for this intent** | No send; show no unavailable action. Refresh may supply a different authorized declaration. |
| Invalid geometry or absent top ID | **Correctable** | Remeasure, or reload malformed rows; never arm a drag or synthesize a row ID. |
| Busy/confirmation/pending-held guard | **Correctable** | Settle or resolve existing operation. No additional submit or confirmation. |
| Read connection/server failure or invalid page/identity/total | **Correctable** | Retry a fresh read, preserve completed history where it exists; no partial capture becomes ready. |
| Unsupported catalogue/application version | **Immutable for this build** | Existing update-app message and exit; no Retry write. |
| Expired/anonymous session | **Correctable by signing in** | Shell clears protected data and handles re-entry. New pass, no replay. |
| Read/resource access withdrawn (403), resource/record missing (404) | **Immutable for this access/target** | Existing classified notice and Back; remove protected active content on withdrawal. |
| Command access/plan refusal | **Immutable for this intent** | Restore the card with the existing safe reason, disable that intent until revalidation, refresh catalogue/read authority or leave. A row-command refusal alone does not prove read access was withdrawn. |
| Command conflict or domain/validation refusal (409/422/other definitive 4xx, excluding auth/missing) | **Correctable** | Restore card with reason; re-read before a new attempt when revision/state changed. No client override of eligibility. |
| Last skipped card no longer in current queue on revalidation | **Immutable for that rewind** | Hide Rewind for that history entry, preserve the skip count, offer remaining actions. |
| Existing outbox refuses Retry/Discard (for example, item is sending) | **Correctable** | Preserve held phase; its existing control explains/waits for settlement. No alternate send path. |

A timeout, connection loss after sending, unreadable success or uncertain
outbox state is **not a definitive refusal**. Stay unknown/held without success
or a deck resend. A 5xx/408/429 after a direct POST is also not proof that no
mutation committed; use the uncertainty path. A read Retry is always distinct
from resubmitting a write. No attempt is automatically repeated because an
animation completed, focus returned, or the user changed motion preference.

## Threshold rules

All gesture distances use density-independent layout points. At gesture begin
capture finite positive untransformed **card surface** width `W` and height `H`,
including its full laid-out surface, not the viewport or the picture alone.
Capture the top ID and session generation too. A geometry change cancels that
drag and requires a new one. Translations are relative to this touch's start:
`x > 0` is physical right and `y > 0` is down. Locale does not reverse physical
direction names.

| Rule | Exact result |
| --- | --- |
| Horizontal threshold | `Tx = W / 3`; left at `x <= -Tx`, right at `x >= Tx`. |
| Vertical threshold | `Ty = H / 4`; up at `y <= -Ty`, down at `y >= Ty`. |
| Arbitration | Compute `hx = abs(x) / Tx`, `hy = abs(y) / Ty`. At `(0,0)` no candidate. Otherwise choose horizontal when `hx >= hy`, vertical when `hy > hx`. Thus equal normalized travel chooses horizontal. Sign selects that axis's direction. Recompute during drag and on release; no axis latch. |
| Availability | Select the geometric candidate before checking the declaration. If that direction is absent or currently locked, armed is false and no action label/tick appears; do not fall back to the lesser axis's command. |
| Arming | Candidate is available and its normalized travel is **at least 1**. Equality counts. Velocity, predicted position and a previous crossing cannot bypass this rule. |
| Overlay | Available candidate's declared label/tone; alpha `clamp(candidateTravel, 0, 1)`, otherwise zero. Label text supplies meaning as well as tone. |
| Tilt | Normal motion: `12 degrees * clamp(x / Tx, -1, 1)`; always within `[-12,12]`. Reduced motion: zero. |
| Rear cards | At most two active cards behind the top, at static scales `0.95` and `0.90` in queue order. No duplicate top or invented placeholders for absent cards. |
| Haptic | One light threshold tick on the first update in this drag that becomes armed. Returning below threshold, crossing again or changing direction never emits another tick. Release produces no extra threshold tick. A haptic failure changes no state. |
| Release | Successful one-pointer release plus the current armed reading dispatches exactly one `choose`. All other releases spring to rest without a choice; cancellation never commits. Buttons/actions bypass gesture distance and use the same choice guard. |
| Invalid input | Any non-finite `x`, `y`, `W`, `H`, or nonpositive `W/H` yields no candidate, not armed, zero overlay and zero tilt; no tick or choice. Extremely small/large measures producing non-finite thresholds/ratios also yield this neutral result. |

One pure worklet-safe helper in `src/core/gesture.ts` returns the candidate,
armed reading, overlay and tilt; native motion and the distance-driven fake call
that helper with measured inputs. The state machine is the only owner of what a
valid release means. Derivation supplies the entire card/control/accessibility
model through `src/core/derive.ts`; surfaces do not reread catalogue JSON or
reimplement the rule. Fixed layout distances, including stack offsets and touch
targets, come from `src/ui/scale.ts`. The ratios and angle above are dimensionless
decision constants, not a reason for core to import the native scale module.

Under normal motion the surface follows the drag, springs back for an undecided
release, and exits in the chosen direction on a choice. On refusal it returns
the same card before unlocking. Under reduced motion there is no card
translation, tilt, fly-off or scale tween: the still candidate label supplies
drag feedback, and accepted/skip/rewind changes cross-fade. Rear scales are
static. Motion preference starts reduced and follows `useFeedback` live; a switch
cancels the current gesture without a choice, stops active travel and settles a
pending visual transition once. It cannot cancel or resubmit a command. Haptics
remain enabled. A missing native motion slot renders the same still card and
buttons, with the same completion transition and no timing-dependent lock.

## Accessible and localized presentation

Visible controls and named card actions have order Rewind, left, down, up,
right, omitting unavailable entries. Rewind uses the existing kit word/icon;
command directions use their declared labels/icons/tones. Keep labels visible,
use native buttons with existing `hit` sizing, and allow wrapping/scrolling at
large text sizes. Rear cards and duplicate overlay labels are decorative and
hidden from accessibility. Only the top card is actionable. Its accessible name
is its existing derived title/status/facts, not raw IDs or a list of command
names. Activate opens the record only in ready state; named actions dispatch
`choose`, with an additional Rewind action when allowed. Unknown action names
do nothing. Busy actions announce disabled/busy and cannot enqueue a second act.

Move reading focus to the new top after acceptance/skip/rewind, or to the
restored card and its reason after refusal. Confirmation dismissal restores its
origin; end state focuses its title. Announce progress and encouragement once
politely per settled choice, not on each drag frame; announce the persistent
refusal notice once. No toast carrying an error disappears on a timer. Preserve
the existing card image failure/placeholder behavior: image failure does not
prevent a textual decision. No extra native keyboard arrow protocol is required
by this phone brief; native buttons provide the keyboard/switch-access path.

All new kit strings go through `src/core/copy.ts` with en/pt entries; these are
the specified missing words (count formatting uses the existing locale helpers).
Server command labels stay the catalogue's localized words. Existing loading,
Retry, Back, uncertainty, hold, rewind and classified failure copy is reused.

| Meaning | en | pt |
| --- | --- | --- |
| Toolbar | Review {n} | Rever {n} |
| Local down action | Review later | Rever mais tarde |
| Skip count | {n} left for later | {n} para mais tarde |
| No authorized choice | No review actions are available. | Não há ações de revisão disponíveis. |
| Five choices | Nice — 5 reviewed. | Boa — 5 itens revistos. |
| Verified empty queue | All caught up | Tudo em dia |
| Finite pass complete, queue nonempty | Review complete | Revisão concluída |
| Queue changed | The queue changed. Reviewing the items loaded. | A fila mudou. A rever os itens carregados. |
| Final count read failed | Couldn't check the queue. Try again. | Não foi possível verificar a fila. Tente novamente. |

Use existing `deriveMeter` fraction wording for “7 of 14” / “7 de 14”. End counts
are in declared direction order and use that direction's declared label; skip
uses the dedicated left-for-later sentence. Include zero for each offered
direction, omit directions that were never declared, and never infer labels
such as “Approved” from left/right or a verb. Keep existing testIDs intact; the
new journey uses `resource-deck`, `deck-card`, `deck-progress`, `deck-rewind`,
`deck-left`, `deck-down`, `deck-up`, `deck-right`, `deck-notice` and `deck-end`,
alongside `review-queue` on the list control. No new ID replaces `resource-list`,
`resource-detail` or `command-*` in their existing journeys.

## Conformance cases specified before implementation

These are test vectors, not executed assertions in this specification phase.
Use the existing fake API/shell/outbox store and a deferred response for races.
The gesture fake supplies distances, release success/cancellation and preference
changes to the **production** arithmetic and reducer. It must not accept an
“armed” flag or implement its own thresholds/counts. There is no SQL deck service
or SQL conformance fake in this client task; the server's authorization and
transaction decisions remain server-owned and require independent integration
evidence. A simulated refusal proves client recovery only.

| Case | Inputs through existing fake / pure rule | Required observable result; reason |
| --- | --- | --- |
| Queue count | Ordinary list total 41, declared queue total 6 | Review 6; capture uses only declared filters/order. Ordinary user filters never narrow or expand the deck. |
| Empty and unauthorized | Queue 0; separately directions `{}` with total 6; separately down-only skip with total 2 | Zero/unauthorized controls disabled with explanation; skip-only session is usable. Deep-link zero has no `0/0` or celebration. |
| Capture and offset shifts | Initial 23; pages 20 and 3; first later command removes a row | Capture offsets 0,20 before any POST; all 23 unique captured IDs can be visited once. No shifted-page omission caused by this phone's command. |
| Duplicate and churn | Initial 23; second page repeats one ID and adds two | Roster 22, first occurrence wins, changed-queue notice; at most the original bounded scan, no search for missing slot 23. |
| Accepted command | Top A then B; right acceptance returns validated row A | One POST for A with declared verb/no body, one history entry/write notification, progress `1 of 2`, B enabled only after settlement. |
| Defaulted command | Direction command has one explicitly defaulted argument; then variant lacking default | Valid default sends no body for server defaulting; missing default suppresses deck with hint notice and no POST. Do not apply primary-row swipe's stricter zero-fields rule here. |
| Confirmation | Left is destructive/has a consequence | All three input paths open the same confirmation. Cancel sends zero; duplicate release/press while confirming still sends zero; one Confirm sends once. |
| Skip and rewind | A,B,C; skip A, skip B, rewind | Active B,C; deferred A; history only A/down; progress `1 of 3`; no command or shell write. Another rewind restores A before B,C. |
| Undo barrier | Skip A; accepted command on B; request Rewind | No Rewind action/button, no inverse POST; an older skip cannot be undone through a later irreversible command. A token-looking row field grants nothing. |
| Refusal restores | Top A; command rejects definitively with 409, 422, 403 or 404 variants | A restored with classified localized reason; history/write/receipt unchanged. Correctable vs immutable recovery matches table. 403 on a command alone does not remove readable rows. |
| Held versus accepted | Existing real outbox over fake store returns `{sent:false,item}` | Same card and held notice, zero progress/success haptic; another input creates no second item. Removing the item is not a success receipt. |
| Unknown outcome | Deadline; malformed 2xx; lost response; direct 503 variants | Same card in unknown, no progress/rewind/new send. Read Retry/reopen never replays the operation. |
| Guarded settlement | Release and button together, duplicate result, obsolete animation callback | One intent and one count; only current session/operation can settle. |
| Identity and catalogue race | Pending A; sign out/change server/person or remove deck; then resolve A | No old card/count/focus/burst in new session; server outcome not misreported as rolled back. |
| Return from detail | A pending, B pending, C skipped; live bounded read no longer includes B or C | B removed without direction credit; denominator decreases by one, C's existing skip count retained and rewind hidden; A uses fresh row. Newly arriving D waits for a new pass. |
| End is not empty | Skip both cards of a down-only deck; final live total 2 | Pass ends, `2 of 2`, down count 2, “Review complete” / 2 left for later; no automatic repetition or queue-empty burst. |
| Verified empty | Decide both cards; final live total 0; duplicate callback and count Retry | “All caught up”, two direction credits, finishing once. Initially empty total 0 gives the words without a burst. Failed final count never claims empty. |
| Five and rewind | Five skips, rewind to four, skip again | First crossing of five shows encouragement once, never again in this session. Reopen starts a fresh session. |
| Accessible equivalence | For each offered direction: successful armed release, button press, named action | Same `choose`/confirmation/send or skip, same disabled guards, declared label and order; unknown named action sends zero. |
| Still organism | Ready 3 cards; one card; no cover; failed image; submitting; refusal; held; both end variants; en/pt | Structural still snapshots/assertions show derived title, status, at most two facts, correct controls/progress and notices. No native animation is required for meaning. |
| Native runtime | Serialize/invoke real gesture worklet and release bridge as existing row tests do | Helper works synchronously on UI runtime; one release reaches one choice; fake-only passing cannot establish this. |

Independent geometry vectors use `W=360`, `H=640`, hence `Tx=120`, `Ty=160`,
with all directions declared unless stated otherwise:

| Translation / event | Expected reading or effect |
| --- | --- |
| `(119,0)`, `(120,0)`, `(121,0)` | Right unarmed, right armed, right armed; exact equality is pinned. |
| `(-120,0)`, `(0,-160)`, `(0,160)` | Armed left, up, down respectively. |
| `(0,159.5)` | Down unarmed; no velocity override. |
| `(120,160)` | Equal normalized travel: right armed, not down. |
| `(119,240)` | Down armed; if down absent, unarmed with no fallback to right. |
| `(240,160)` | Right armed; tilt exactly +12 degrees despite excess travel. |
| `(-240,160)` | Left armed; tilt exactly -12 degrees. |
| `(0,0)`, any NaN/infinite input, zero/negative W or H | Neutral, no overlay/tilt/tick/choice. |
| Drag x: 119 → 120 → 80 → 130, then release | One threshold tick, one right choice on release. |
| Drag x: 130 → 80, then release | One tick, zero choices, same top restored. |
| Drag x: 130 → -130, then release | One tick total, one left choice, never a right command. |
| Armed drag then cancelled / extra pointer / resized card | Zero choices; no queued callback can later commit it. |
| Reduced motion with armed right drag/release | Same tick and choice; zero tilt/translation/fly-off, cross-fade on accepted result. |

## Ten contract questions and Limits

| Question | This client's resolved share | Server / product limit |
| --- | --- | --- |
| Entity fields | Existing resource rows plus the transient session fields above; no new persistent entity or mutable result columns. | Product declares resource fields and queue/direction semantics. |
| Identity and relationships | Existing server/person/session binding, resource key and row ID; history relates each local choice to that row. | Tenant resolution/RLS remains the server transaction's responsibility. No tenant scope is inferred from a client label. |
| States and transitions | The table above is authoritative for all input/effect paths; unlisted transitions do nothing. | Group votes, matches, ranking and question lifecycle belong to Decide, outside Review. |
| Authorization | Offer only the current authorized catalogue's directions; recheck locally on confirmation/release; shell handles expiry and withdrawal. | Every server command must recheck grants and tenant scope in its authoritative transaction. The catalogue is not authorization at write time. |
| Transaction and concurrency | Serialize deck intent, guard generations/operation IDs, freeze a bounded observed roster before own writes, count only validated acceptance. | No client transaction, lock or expected revision is invented. The pinned deck/command contract supplies no universal revision check; authoritative domain/revision guarantees require server-owned evidence. |
| Events and idempotency | Core events are local state inputs. Reuse one command/outbox/idempotency path and one shell write notification per confirmed command; skip/rewind emit no domain event. | Domain state and outbox event must commit together on the server. A sent idempotency key alone does not prove deduplication; transport-level duplicate risk remains the existing outbox's documented limit. |
| Retention and export | Roster, skipped order, history and encouragement are memory-only for this Review session; discarded on its end. Existing held writes retain their existing scoped storage/lifecycle. No deck export, audit ledger or migration. | Product/server owns retention, audit and export of its domain records/events. |
| Provider integration | Existing API, secure session, picture, feedback and media-renderer seams only; no provider discovery/configuration or new native dependency. | Product composes any domain providers and custom screens through the existing renderer pack. |
| Locale/time/money | en/pt kit copy, declared localized labels, existing number/time/value formatting. State uses operation order, not wall-clock timing; any effect timestamp uses the injected Clock. No monetary arithmetic is introduced. | Domain money remains minor units plus currency and timestamps UTC on the server; no specialist/currency/time-zone defaults are invented here. |
| Specialist validation | Only deck structure, supported generic field references, geometry and state guards; no inference from status/verb names. | Product/server validates eligibility, last-one rules, legal/sector rules and consequences. Review does not certify any such rule. |

Two brief items are deliberately bounded by the actual contract. Command rewind
is deferred until an upstream declaration **and** authoritative token/undo
operation exist; this target implements local-skip rewind only. Completion is
split into finite-pass completion and verified-empty “All caught up”, so skips,
commands that leave queue membership unchanged and concurrent arrivals cannot
produce a false empty-queue claim or an infinite skip loop. The remaining brief
items are retained. Exact animation timing/easing is a presentation choice in
the existing motion layer, subject to the state, tilt and reduced-motion rules.

The public API has offset pagination without a snapshot/cursor or stable
tie-break promise. Very large queues require reading all bounded metadata before
decisions; this specification does not claim bounded memory independent of
queue size. Snapshot-consistent or streamed review needs an upstream contract,
not a second client query language. Reopening is a new pass, so a command whose
resource remains in the queue can be offered again and the server remains its
authority. Retained held/unknown operations must be resolved before another
intent for that record; Review cannot prove an unrecorded unknown write's fate
after leaving its session or a process death. A fresh user choice in a new pass
is not evidence that the previous intent failed and does not establish
exactly-once execution.

### Existing native dependency evidence

No dependency or version change is proposed. Registry answers were obtained with
`npm view <package> version license`; these latest versions establish existence,
not an instruction to update the lockfile. Each installed pinned package's
actual LICENSE file was read in full; all four grant the MIT permission and
notice-retention terms. No GPL/AGPL library is selected.

| Existing package | Registry answer pasted verbatim | Locked / installed version | LICENSE read |
| --- | --- | --- | --- |
| `react-native-reanimated` | `version = '4.7.1'` / `license = 'MIT'` | 4.5.1 | `node_modules/react-native-reanimated/LICENSE`: The MIT License (MIT), copyright 2016 Software Mansion. |
| `react-native-gesture-handler` | `version = '3.4.0'` / `license = 'MIT'` | 2.32.0 | `node_modules/react-native-gesture-handler/LICENSE`: The MIT License (MIT), copyright 2016 Software Mansion. |
| `react-native-worklets` | `version = '0.13.0'` / `license = 'MIT'` | 0.10.1 | `node_modules/react-native-worklets/LICENSE`: MIT License, copyright 2024 nobody (as distributed). |
| `expo-haptics` | `version = '58.0.7'` / `license = 'MIT'` | 57.0.3 | `node_modules/expo-haptics/LICENSE`: The MIT License (MIT), copyright 2015-present 650 Industries, Inc. |

### Verification required for implementation

Implement the vectors with the existing test runners/fakes and add new cases to
the existing inventory. Run the focused deck files first, then `npm run check`
once after changes. Preserve existing flow assertions and include the new screen
and IDs in a deck journey. Use `make e2e-android` to prove the affected journey
on the target platform, recording the exact flows. Native touch/tilt/spring,
UI-runtime bridging, both motion modes, haptics, screen-reader focus/actions,
permission/refusal recovery and live-server concurrency need that evidence;
component snapshots and a fixture cannot establish them. A changed native
fingerprint must use the repository's existing refresh/build recipe and be
reported as requiring a new binary.

This specification and any baseline checks run while writing it do not prove
the future deck implementation, server transactions or device experience.
