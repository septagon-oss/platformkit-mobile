# Shared mobile components specification

Status: implementation round 2 for T-0180, 2026-09-30. Every named family now has
public core factories and native component source; the implementation inventory
below is separate from native acceptance. The inspected baseline is
`2d56f1a36486fa4353dbc7afdfa64707073e47af`. No catalog, HTTP endpoint or database
schema changed. The native dependencies/configuration change the binary fingerprint.

## Implementation status: shared families

Round 2 adds the missing factory/component families through the public source
subpaths. `ResourceList` delegates to `deriveCatalogList`/`DataList`, with native
SectionList owned by ListScreen. `Activity` accepts its derived model; the generated
screen adapts raw authorized events/names and samples the clock. Existing payloads
still supply no before/after schema and therefore produce no invented changes.

The kit adds `DisclosureSection`, `MoreFilters` and `SummaryDetail`. Use disclosure
for secondary detail, MoreFilters for additional query choices, and a summary plus
an explicit page/sheet for full detail. Do not hide required input or a primary
control. Two disclosure levels are supported; a third level is a sibling surface
or a routed detail screen owned by the product, not another nested accordion.

Literal Gallery examples derive through the same factories. The new examples
cover the family inventory and selected refusal/busy/selection states; the complete
matrix below remains the acceptance target, not a claim that every cell ran.
Map examples have no configured tile service, and media examples are labelled
synthetic render slots. `renderImage` and `renderZoom` let a consuming Gallery use
its actual adapters. No device or every-product palette acceptance is implied.

MapLibre 11.4.0, Expo-pinned Image/FlashList/SVG/Gesture Handler and Zoom Toolkit
5.1.1 are now pinned. Native image and map callbacks have scope/version guards;
map resources are supplied explicitly, and image persistent caching is disabled.
Temporal 0.5.1 and D3's pure scale/shape packages own civil arithmetic and chart
geometry. Expo-managed dependencies remain checked against its installed manifest;
independent packages have explicit exact pins and native-shape checks. Unknown
dependencies still fail the gate. Native build/runtime results belong in the
implementation report and must not be inferred from these metadata checks.

Installed package metadata records these runtime additions (one installed version
per `npm ls`): Temporal 0.5.1, d3-scale 4.0.2 and d3-shape 3.2.0 are ISC;
MapLibre 11.4.0, Expo Image 57.0.5, FlashList 2.0.2, SVG 15.15.4,
Gesture Handler 2.32.0 and Zoom Toolkit 5.1.1 are MIT. These license/version
records establish package provenance, not device conformance. Supply
`Europe/Lisbon` as the Gallery presentation zone for the named spring/autumn
DST examples; the core always uses the caller's explicit zone.

`PhotoViewer` additionally requires `renderZoom(ZoomSlotProps)` from screen
composition, just as it requires its image slot. `calendarTargets(day, extent, hit)`
accepts measured native sizes for the pure dense-target decision. The model contains
the date and ordered event IDs for the resulting control. No product recalculates
interval lanes. Direct consumers must migrate `ResourceList.presentation` and
`Activity.model` as described in README.

## Implementation status: rich-state slice

The first rich-state implementation extends the four existing atoms and adds
`StateView`, a molecule that renders `deriveState` output. It is available through
the existing UI subpaths; core exports come from `core/derive`. Subsequent family source is described above; full native acceptance remains pending.
Native/device and product-theme acceptance must be recorded separately.

The source migration for this slice is explicit: `Skeleton` and `Spinner` now
require `label` and `motion`; `retry` requires `(feedback, onPress)` and is owned
by core (its old Notice export path re-exports that function). `ListScreen`,
`LoadMore`, `Home`, `ResourceList`, `ResourceDetail`, `ResourceForm`, `SignInForm`
receive a required `feedback` value from `deriveFeedback` in that slice.
Round 2 replaces `ResourceList.feedback` with `presentation` and moves Activity
to its required `model`, as recorded above.
Generated screen compositions supply that value through `useFeedback`, which
starts with reduced motion and subscribes to native preference changes. Custom
renderers can choose EN/PT independently through `deriveCopy` and supply their
own motion adapter. `Row` uses its existing action title for its busy indicator
and keeps that small indicator still.

`Notice` requires explicit announcement urgency. `ChoiceRow` receives
`copy.choice`; `DateTimeRow` receives `copy.dateTime`, `initialValue` and `timeZone`.
Its native picker callbacks ignore a newly disabled or unmounted control, and
Clear is unavailable for required or disabled values. `ResourceForm` also
requires `initialDate`; form, command and singleton screen compositions sample
their injected `Clock` once at mount. `timeText`, `display` and `detailItems` require explicit formatting,
and Value/Labelled receive it as `presentation`. These remove the shared mutable
formatter and component-owned choice words. `StateFeedback` is the optional
screen adapter for iOS announcements; Gallery accepts its `renderState` slot.
The README's Shared feedback section lists the complete source migration.

`deriveCopy('en' | 'pt')` returns an immutable bundle directly, matching the common
Copy contract; unsupported runtime languages throw `RangeError` with code
`unsupported-format`. `deriveState` returns the documented Result. Copy keys are
added with their consumers: this slice supplies state, choice, date-control, boolean value,
integration-error and state-gallery words; subsequent families add the typed EN/PT kit bundle.

## Ownership and compatibility

This extends the existing native library. `src/core/derive.ts` remains the public
owner of the values, labels, controls and decisions that UI draws. It may delegate
to focused pure files inside `src/core/` and re-export their types; consumers use
the existing `platformkit-mobile/core/derive` subpath. Neither React, native APIs,
network access, storage, the clock nor mutable configuration enters core.

The existing consumer is `src/screens/useResourceList.ts` →
`src/screens/ResourceList.tsx` → `src/ui/organisms/ResourceList.tsx` → `ListScreen`,
`Row`, `Section` and the derive helpers. Detail and form have the same
hook/composition split. `src/route.tsx`, `src/renderers.ts` and the renderer pack
passed once to `Shell` remain the integration path. There is no new registration
mechanism, shell, permission system or design system.

UI receives immutable models from derive and synchronous intent callbacks from
its screen. An intent does not mean that a write succeeded. Only the screen owns
requests, cancellations, navigation, draft persistence and meaningful haptics.
HTTP and secure storage continue through `src/effects/`. A native rendering
provider is supplied explicitly by screen composition, as described under maps
and media; UI does not acquire a provider, credentials or a session.

The actual import graph is the one in `eslint.config.mjs`: atoms compose atoms;
molecules compose atoms; templates compose atoms/molecules through children or
render slots; organisms compose those layers. In particular, a detail template
must not import `ResourceDetail` or `Activity`. Theme and scale import no
components. This specification requires no relaxation of these rules.

Existing public component names and package subpaths remain. The explicit
copy/clock migration below changes required props; it does not promise source
compatibility for callers that currently rely on hidden defaults.
`ResourceList` becomes the catalog adapter to the one `DataList` renderer;
`ResourceDetail` delegates its content to the same derived detail rows when
embedded in a sheet. Existing `Activity` is extended, not replaced by a second
audit renderer. Shared copy lives in core, never in component-local English
literals. Migrate the traced list, detail and form consumers in the
slice that changes a shared primitive; remove their replaced formatting and
rendering rules in that slice. Do not silently add resource-query syntax, a
revision field, a saved-view endpoint or permissions to discovery.

## Delivery order and reuse ledger

Each row is a separately reviewable slice. Complete its state, locale, theme,
accessibility, tests and native evidence before starting the next. Timeline is
placed with the first list/detail family; pricing tiers follows exact money and
product presentation. Neither group is dropped because the shorter brief's
ordering sentence omitted it.

| Slice | Deliverable and reuse decision |
| --- | --- |
| 1.1 | Rich states: **composed from** `EmptyState`, `Notice`/`retry`, `Skeleton`, `Spinner`, `Button` and Gallery. Extend these; do not introduce competing empty/error/success atoms. |
| 1.1 | Presentation/copy/clock input: **composed from** `timeText`, `timeWire`, `display`, `control`, `Order` and activity time helpers; explicit EN/PT copy tables and the screen's injected clock are **new, because** the trace found no copy-table/clock-input owner. No clock service or global configuration is added. |
| 1.2 | `DataList`: **composed from** `ResourceList`, `ListScreen`, `Row`, `Section`, `LoadMore`, `Actions` and core list/order helpers; the generated adapter loses the rendering this extracts. |
| 1.2 | `ChoiceChips`: **composed from** `ChoiceRow`'s option contract, `Button`, `Badge` and existing core sort/filter derivation; this adds a chip presentation, not a second choice rule. |
| 1.2 | `SelectionControl`: **new, because** the inventory has no checkbox/selection atom; compose native Pressable, existing Icon/Text and the same button interaction styling. `SwitchRow` remains a boolean form input. |
| 1.2 | `ActionBar`: **composed from** Button and the explicit command/action inputs already used by `Actions`; one action-row renderer is shared by list, sheet, stepper and purchase controls. |
| 1.3 | `DetailSheet` and `SidePanel`: **composed from** `Screen`/`useCanvas`, `DetailRow`, `ResourceDetail` content and the existing native modal presentation pattern. One `DetailSurface` layout owns both presentations. |
| 1.4 | Timeline/audit: **composed from** `src/core/activity.ts`, `Activity`, `Section`, `Badge`, `DetailRow` and the existing `useActivity` reader. Before/after is explicit supplied data, not inferred history. |
| 2.1 | `Stepper`: **composed from** Button, FormField, Screen and existing form phase/dismissal patterns; the small pure adjacent-step decision is **new, because** no multi-step owner exists. |
| 2.2 | `SlotPicker` and `SlotOption`: **composed from** DateTimeRow, ChoiceChips, Button and UTC helpers; the supplied availability/capacity decision is **new, because** a native instant input has none. |
| 2.3 | `DayStrip`, `WeekCalendar`, `AgendaList`, `Calendar`: **composed from** core time helpers, ChoiceChips, Row/Section, ListScreen and date navigation; day grouping/overlap layout is **new, because** no calendar model exists. |
| 3.1 | `Price`, `ProductCard`, `QuantityControl`, `BuyBar`, `Cart`, `OrderSummary`: **composed from** Text, Badge, ChoiceChips, Row, Section, Button, ActionBar and Screen/useCanvas. Exact minor-unit arithmetic is **new, because** `numberValue` is not an int64 money owner. |
| 3.2 | `PricingTiers` and `PlanComparison`: **composed from** Price, Section, Badge, ActionBar, ChoiceChips and the same derived feature values. There is no second pricing calculator. |
| 4.1 | `MapWithList` and `MapLegend`: **composed from** DataList, ChoiceChips, DetailSheet and status Badge semantics. The explicit native map rendering adapter is **new, because** the inventory has no map provider. |
| 4.2 | `MediaHero`, `PhotoGallery`, `PhotoViewer`, `MasonryWall`: **composed from** existing themed layout, Button, DetailSurface and rich states. Image/viewer/masonry adapters are **new, because** the inventory has no media owner. |
| 4.3 | `Sparkline`, `AreaChart`, `BarChart`, `StatTile`: **composed from** core's pure boundary, Text, Badge, ChoiceChips and rich states. Chart domain/projection rules are **new, because** no scale or chart owner exists. |
| Every slice | Gallery, tests and journeys: **composed from** `src/ui/gallery.tsx`, `tests/derive.test.ts`, `tests/ui/*`, `tests/screens/*`, `tests/layers.test.ts`, `tests/fakes/shell.ts`, `tests/fakes/router.ts` and `e2e/flows/gallery.yaml`. Reuse these fakes and the existing sign-in journey, not parallel harnesses. |
| Every slice | Tokens, exports and binary handling: **composed from** ThemeProvider, `themeFor`, `useStyles`, scale, the source-package checks, token provenance and fingerprint/build recipe. Public subpaths remain the UI layer exports; add only an explicit `ui/gallery` export when Gallery becomes consumable. |

## Common contract

The type notation in this document is normative interface notation, not checked-in
implementation. Arrays/records and all their entries are readonly. `?` means
omitted; an empty string is not an ID, label, locale or currency. A `Model` contains
only validated display data and control descriptors, never React nodes or
callbacks. UI props are `{ model, ...callbacks, testID? }`, except the existing
compatibility surfaces and the named composition slots below.

| Type | Exact meaning |
| --- | --- |
| `ID` | Nonempty opaque string. Unique within the containing collection and stable across paging/reordering. Never an array index, translated label or authorization credential. |
| `Instant` | RFC 3339 instant with explicit offset, accepted at the input boundary and normalized by core to UTC with millisecond precision. Reject invalid dates, leap-second syntax and finer-than-millisecond input; no local-time parsing. |
| `LocalDate` | A valid ISO Gregorian `YYYY-MM-DD` date, independent of an instant. No implicit device-zone conversion. |
| `Copy` | Opaque complete core bundle obtained from `deriveCopy('en' \| 'pt')`, with readonly language identity. Consuming apps do not assemble partial key tables; product text enters the explicit content/Action fields below. The key families below are the bundle's coverage requirements, not a second public string registry. |
| `Presentation` | `{ locale: string; timeZone: string; weekStartsOn: 1 \| 7; now: Instant; motion: 'normal' \| 'reduced'; copy: Copy }`. Locale is an explicit supported BCP 47 tag, timeZone an explicit IANA zone or `UTC`. Copy chooses language independently of number/date locale. The screen samples the clock and device preferences; core never does. An unresolved motion preference supplies `reduced`. |
| `Status` | `{ label: string; tone: 'neutral' \| 'info' \| 'ok' \| 'warning' \| 'danger'; symbol: 'none' \| 'check' \| 'clock' \| 'warning' }`. Caller supplies meaning; UI maps the semantic role through theme. No status-name-to-colour guessing. |
| `Action` | `{ id: ID; label: string; hint?: string; tone: 'primary' \| 'secondary' \| 'plain' \| 'destructive'; state: 'ready' \| 'disabled' \| 'busy'; reason?: string }`. Disabled requires a visible, localized reason. Busy retains the original label and suppresses activation. Absent means not offered. |
| `Issue` | `{ code: string; path: string; recovery: 'correctable' \| 'immutable'; message: string }`. Core owns the finite code set and translates through Copy; paths name inputs, not private server internals. |
| `Result<T>` | `{ ok: true; value: T }` or `{ ok: false; issues: readonly Issue[] }`. Invalid input produces no partial value/model. Issues follow input traversal order; no mutation, callback or logging happens during derivation. |
| `Content<T>` | `{ phase: 'loading' }`, `{ phase: 'empty'; state: StateModel }`, `{ phase: 'error' \| 'offline'; state: StateModel }`, or `{ phase: 'ready'; value: T; refresh: 'idle' \| 'loading' \| 'error' \| 'offline'; notice?: StateModel }`. Ready+loading keeps existing content. Ready+error/offline requires a notice and may show stale readable content; first-load errors do not masquerade as empty. |
| `Page` | `{ more: boolean; loading: boolean; error?: string }`; `onMore()` is emitted only when more and neither loading nor blocked by the enclosing phase. Its count, if known, is supplied separately; no component invents a total from a page. |

`derive<Name>(input, presentation)` returns `Result<NameModel>`. Specific input
records and output obligations are defined below. The same functions derive
gallery fixtures, real screen props and tests. Core derives all joined labels,
formatted values, eligibility, selection markers, progress and display geometry.
UI may translate normalized geometry into measured native layout and render
theme styles; it must not repeat eligibility, totals, sort, formatting or status
decisions. Templates accept children, not domain records they reinterpret.

Callbacks are synchronous `void` notifications. A UI event is emitted once per
activation; it never schedules a retry. The screen must set busy synchronously
and guard re-entry before awaiting an effect. This is not durable idempotency.
Components hold only focus, scroll/gesture and animation state; selection,
expanded IDs, range, quantity, draft steps and selected media are controlled.

Each screen reuses its existing generation guard, keys its rendered subtree by
the active session/resource scope and drops stale responses. Abort obsolete reads
where the existing Api/provider method accepts cancellation; an uncancellable
read still has its late response discarded. No new request runner is introduced.
Changing that scope clears selections, open sheets, drafts and provider resources
before another scope's data is shown. Same-scope refresh may retain readable
rows, but re-derives enabled actions against the refreshed data. Session changes
must never use stale-content presentation. An API response counter is not a
server revision, and cancellation is not evidence of rollback.

### Refusals and recovery

**Correctable** means this workflow may proceed after the specified new input,
read or user correction. **Immutable** means the same request/snapshot cannot be
made valid by retry; replace unsupported/malformed data, use a different
authorized actor, or leave that operation. It does not assert that all future
server state is immutable. Every refusal below uses one of these classifications.

| Code / classification | Refused input or action; required result |
| --- | --- |
| `invalid-input` — immutable | Missing/duplicate IDs, dangling structural references (such as an offer's period or a feature key), contradictory states, missing required copy, malformed timestamps/coordinates/numbers, invalid bounds or models. Return no model and no callback; the screen shows a localized integration error with no repeat-write action. Correct the producer and derive a new snapshot. |
| `unsupported-format` — immutable | Unsupported locale/zone, renderer capability, currency exponent or input shape. Never silently substitute a zone, currency, provider or view. Offer a supported alternative explicitly if the caller supplies one. |
| `unavailable` — correctable | Selection absent, disabled, expired, full, sold out or no longer present after refresh. Preserve the reason; choose again or refresh. No successful selection/commit callback for an invalid target. |
| `busy` — correctable | An action is already pending. Suppress repeat activation until the screen provides an outcome. No queue. |
| `validation` — correctable | Caller-supplied field/step problems or a quantity outside its allowed bounds. Keep input, show the problems and focus the first failing field on submission. |
| `conflict` — correctable | Server reports stale expected revision, changed capacity or changed quote. Screen reloads current authorized state, reconciles selection and asks for a new explicit submission. It must not apply a stale returned row. |
| `read-failed` / `offline` — correctable | A read failed or connectivity is unavailable. Retry only an explicitly offered read. Stale content is labelled, and affected writes are disabled with a reason. |
| `write-unknown` — correctable by reconciliation | Timeout/cancellation after a write may have committed. Show pending/unknown, disable repeat submission, and recover through that capability's persisted read/idempotency contract. Never relabel this as an ordinary retryable read error. |
| `forbidden` / `not-found` — immutable for this actor/record | Screen removes unauthorized/deleted content and actions. No retry-write control, cached row, event or before/after disclosure. The server owns the authoritative refusal. |
| `read-only` — immutable for this surface | An audit entry, receipt, booked slot or current plan is display-only. Reading zero such entries is valid empty content; the kit imposes no “must contain one” write invariant. |

Pure selection helpers return the current selection for a repeated selection of
the same enabled ID; UI emits no redundant change callback. Deselection is only
offered when the particular contract allows it. An absent or ineligible
controlled selected ID becomes an explicit invalid-selection model, with no
automatic side-effect callback during render. The screen reconciles it and the
next user action must use an eligible ID.
This is `unavailable` (correctable) even on the first supplied snapshot; pure
derive does not guess whether an absent selection was formerly valid. Structural
references are validated separately. A late callback for an ID that is no longer
eligible is suppressed against the current model/session generation.

### Copy, locale, time and money

All visible and accessible copy comes from core or explicit product content. No
UI component contains a default user-facing string, including Cancel, Retry,
loading names, announcements, chart units, before/after headings or image errors.
Core supplies complete English and Portuguese `Copy` objects with the same typed
keys and argument signatures. Product nouns, field labels, plan features, status
meaning, alt text and legal copy are supplied by the caller; core must not
translate an unknown noun by appending an English `s`.

Locale and language are separate: a caller can choose English copy with a
Portuguese number/date locale. Required fixtures use `en-GB`, `pt-PT` and `pt-BR`;
there is no implicit claim that Portuguese has one currency or one timezone.
Use `Intl` with explicit locale/zone, with formatters scoped to that presentation
instance or keyed by all immutable formatting inputs. Remove the current
device-zone-only mutable formatter when migrating timeText. Existing helper
entry points delegate to the same explicit formatter; they do not retain a
hidden clock or language default. The screen resolves device settings and
supplies presentation to every migrated path. Activity's core adapter receives
now and DateTimeRow receives its initial instant from the screen, never
`new Date()` in UI.

The owning screen's clock is an explicit dependency (`{ now(): Instant }`),
sampled when deriving, on return to the foreground and immediately before a
time-sensitive intent. Its timer refreshes at the next relevant slot start or
snapshot/quote expiry; it is cancelled on scope change. Core supplies those
boundaries and reads no timer. A stale rendered button is not permission to use
an expired snapshot; the screen re-derives before dispatch and the server still
rechecks its own authoritative clock inside the command transaction.

The following key families are mandatory. Copy functions own interpolation and
plural selection; strings are not assembled in renderers. Default action pairs
include Retry/Tentar novamente, Cancel/Cancelar, Close/Fechar, Back/Voltar,
Next/Seguinte, Save and exit/Guardar e sair, Select/Selecionar, Clear/Limpar and
Loading/A carregar. Additional regional system-copy variants belong in the same
typed core bundle and tests; they are not component-local overrides.

| Copy family | Typed arguments and coverage |
| --- | --- |
| `state` | empty title/body, loading, offline title/body, error title/body, success title/body; `updatedAt(instantText)`, retry, dismiss, unknown-write explanation. |
| `choice`, `list` | choose/cancel/hint; `count(n)`, `selected(n)`, `loadedOf(loaded,total)`, order/filter/reset/refresh, select loaded/clear selection, save view/unsaved view, show more, no matches; singular/plural branches. |
| `detail`, `activity` | close, unsaved/busy reasons, before/after/missing/redacted, system/unknown actor, older, unavailable history, `event(actor,verb,time)`, exact time and relative time. |
| `step`, `slot`, `calendar` | `progress(current,total)`, complete/skipped/required/unsaved, next/back/save-exit/finish, available/full/booked/closed/expired/unknown, `capacity(remaining,total)`, date/time/zone, today/previous/next week, all day, continues, `moreEvents(n)`. |
| `product`, `plan` | price/estimate/quote-expired, quantity/increase/decrease, options/required/sold-out, cart/remove/subtotal/adjustments/total, current/recommended/contact, billing period and included/excluded/unknown features. |
| `map`, `media`, `chart` | map/list/legend/zoom/reset/attribution; image missing/loading/retry, `position(index,total)`, previous/next/close/zoom; data table/range/no samples, missing value, delta increase/decrease/unchanged/no baseline and all control hints. |

Core's calendar adapter uses explicit imports from `@js-temporal/polyfill` for
Gregorian civil-date arithmetic and IANA-zone day boundaries, with no global
patch. UTC intervals are half-open `[start,end)`. A civil day can contain 23, 24
or 25 hours (and unusual zone transitions); adding 86,400,000 milliseconds is
not a day operation. Slots arrive as instants; no nonexistent/ambiguous local
wall time is silently converted into a booking. See the calendar cases below.

`Currency = { code: string; fractionDigits: number }`: code is three uppercase
ASCII letters supplied by the price contract, and fractionDigits is an integer
from 0 through 4. The currency/exponent pair is an identity; inconsistent
exponents for the same code are `invalid-input` (immutable). This validates a
presentation representation, not whether a currency is legal tender.

`Money = { minor: string; currency: Currency }`: minor is a canonical decimal
integer (`0` or an optional minus followed by a nonzero leading digit), in
`[-9223372036854775808, 9223372036854775807]`. No `+`, leading zero, decimal,
exponent or negative zero. Use bigint for arithmetic; serialize decimal strings,
never JSON bigint or floating point. Format the complete amount exactly with
explicit Intl locale and currency parts, retaining all fraction digits; never
convert the amount to Number first. Always use `currencyDisplay: 'code'` and
`currencySign: 'standard'`; locale controls code placement and separators. No
exchange rates, percentage taxes, inferred discounts or
locale-derived currency are part of this contract.

### Gallery and acceptance matrix

Extend the literal examples in `src/ui/gallery.tsx`; there is no self-registration
or story-discovery mechanism. Gallery accepts a complete `palette` light/dark
pair, `fonts`, `presentation`, and an optional initial case ID. Omitted palette
and fonts preserve the existing reference defaults. Its mode, locale and case
controls use supplied copy. Every new atom and molecule has its own entry, and
each organism/template has a composition entry as well.

Every case below is rendered in light and dark, English and Portuguese, and with
each consuming product's supplied complete token pair/fonts. Public fixtures use
the reference palette and the injected palette/independent-provider cases already
exercised by `tests/ui/theme.test.tsx`; they do not stand in for unavailable product palettes.
Each product runs the same Gallery with its palette through the public props and
records its own evidence outside this source repository. No product is counted
as verified until those renders exist.

Case IDs have the form `<component>/<state>`; device IDs use the caller's testID
plus a deterministic child suffix and the encoded stable ID, never visible text.
The Gallery supplies concrete literal IDs for Maestro and extends the existing
gallery flow. State demonstrations cannot rely on a mocked screenshot to pretend
an actual focus, gesture, keyboard or announcement occurred.

The common case suffixes are `default`, `hover`, `pressed`, `focus`, `disabled`,
`busy`, `loading`, `empty`, `error`, `offline`, `success`, `large-text` and
`reduced-motion`. Add these to each applicable component's named cases below;
an existing identical suffix is one case, not a duplicate. The Gallery records
N/A with a reason for passive/unsupported states; it does not invent interactions
for a price label or claim native pointer hover on a touch-only device.

| Matrix row | Required behavior and proof |
| --- | --- |
| Default | Long/short content, no hidden actions, responsive layout and stable identities. |
| Hover/pressed/focus | Every interactive control: native pressed feedback; pointer hover only on pointer platforms; visible keyboard focus; Enter/Space or native activation. Passive content has these marked N/A with no fake focusable control. |
| Disabled/busy | Disabled name/state/reason, no callbacks from touch/keyboard/assistive action; busy preserves label and blocks re-entry. Passive content inherits the enclosing state rather than becoming a disabled button. |
| Loading/empty/error/offline/success | Skeleton before first read; real zero-result state; retry only for read failures; stale readable content labelled; success only after supplied success. Static atoms are shown inside the corresponding enclosing state. |
| Accessibility | Native roles/names/value/selected/expanded/busy states. At least existing `hit` (44pt, Android 48dp), no overlapping targets. Text contrast >=4.5:1, large text and meaningful graphics/focus >=3:1, measured for each supplied palette/mode. Status also has text/symbol. |
| Keyboard and screen readers | Complete journey with external keyboard, then VoiceOver and TalkBack. No swipe-, hover-, pinch- or colour-only action. Overlay focus enters, background is excluded, close restores the trigger or an explicit fallback. |
| Large text/motion | 200% and the platform's largest supported text setting, long Portuguese labels, narrow phone and tablet. No clipped action/price/error; controls wrap or scroll. Reduced motion disables skeleton pulse and camera/chart/step transitions; no autoplay. |
| Native layout | Safe areas through existing canvas; persistent actions above bottom inset and keyboard. Test keyboard-open forms, nested sheet scrolling, system back and sheet dismissal. Haptics only after caller-confirmed meaningful selection/commit, through screens. |
| Evidence | Core assertions plus native-rendered interaction tests and actual device screenshots. Component tests and static `check:flows` are not device, contrast, visual-parity or server evidence. |

## 1.1 — Rich states

`StateText = { title?: string; body?: string }`; `StateAction = {
intent: 'next' | 'retry-read' | 'dismiss' | 'reconcile'; control: Action }`;
`StateActions = { action?: StateAction; secondary?: StateAction }`.
`StateInput = (StateText & { kind: 'loading'; skeleton: 'lines' | 'rows' |
'detail' | 'media' }) | (StateText & StateActions & { kind: 'empty' | 'success' }) |
(StateText & StateActions & { kind: 'offline'; updatedAt?: Instant }) |
(StateText & StateActions & { kind: 'error'; issue: Issue; updatedAt?: Instant })`.
Only loading carries skeleton. Offline/error may carry updatedAt when displaying
stale readable content. An immutable error cannot receive a `retry-read` action;
`write-unknown` permits reconciliation or dismissal, never a retry-read intent.
Intent is an explicit value, never inferred from the action's ID or label.
Empty is a successful zero result, never a transport failure. Success is a
supplied confirmed result, persists until caller dismissal, and is not a timer
that loses an actionable message.

`deriveState` selects the existing atom and returns `StateModel` with resolved
title/body, actions, announcement (`none | polite | urgent`), and skeleton shape.
Urgent is reserved for an error preventing the active task; routine success,
counts and offline transitions announce politely once per actual state change.

| Component / layer | Props and events | Gallery cases; reference |
| --- | --- | --- |
| `EmptyState` / atom | Existing title/text and optional action remain its display fields; action gains shared disabled/busy/reason semantics. `onAction(id)` in the model-based composition; no automatic “create” action. | `empty-state/with-action`, `read-only`, `filtered`, `long-copy`, `action-busy`; R01. |
| `Notice` / atom | Existing tone/title/text/action extended with secondary action and explicit announcement. `onAction(id)` and optional dismiss action; no internal retry policy. `retry` is core copy derivation, not an English constant in UI. | `notice/error-correctable`, `error-immutable`, `offline`, `stale-offline`, `write-unknown`, `success`, `success-action`; R01 for content/action hierarchy, R13 for inline confirmation. |
| `Skeleton`, `Spinner` / atoms | Core-derived accessible loading label; skeleton variant/line count, explicit reduced-motion result supplied by the accessibility adapter. No events. Shapes reserve content space and are one announced loading region, not individually focusable rows. | `skeleton/lines`, `rows`, `detail`, `media`, `reduced-motion`; `spinner/default`; R01's eventual content hierarchy, not a screenshot of a skeleton. |

An enclosing screen chooses one Content branch; a state renderer does not
dispatch network work. Skeleton dimensions remain in scale. The existing native
accessibility preference subscription may stay a presentation adapter, but must
handle preference changes while mounted and default to still until resolved.

## 1.2 — Data list and shared controls

`DataRow = { id: ID; title: string; summary?: string; cells: readonly
{ id: ID; label: string; value: string }[]; status?: Status; selectable: boolean;
selectionReason?: string; open?: Action; actions: readonly Action[] }`.
The catalog adapter obtains title/cells from `label`, `listCells`, `listPreview`
and `display`; custom screens supply equivalent generic inputs to derive.

`DataSection = { id: ID; title: string; rows: readonly DataRow[];
total?: number; collapsible: boolean }`. Totals are nonnegative safe integers
and cannot be below loaded count. Unknown total is omitted. Section and row
order is caller order; a row occurs in exactly one section. A collapsed group
retains its count. No local alphabetical reorder or inferred status grouping.

`Choice = { id: ID; label: string; count?: number; enabled: boolean;
reason?: string }`; `ChoiceGroup = { id: ID; label: string;
choices: readonly Choice[]; selectedId?: ID; required: boolean }`.
`Filter = Omit<ChoiceGroup, 'choices'> & { field: string; choices: readonly
(Choice & { value: string })[] }` uses an existing catalog field or an explicit
caller-owned query key. `Sort = Omit<ChoiceGroup, 'choices'> & { choices: readonly
(Choice & { value: Order['sort'] })[] }` includes an explicit default option
with a nonempty UI ID and empty wire value. IDs are not query syntax. The same
existing Order/queryFilters helper maps filter choice values; clearing removes
that field. Supplied selected choices must agree with the corresponding Order
values; contradictory snapshots are invalid-input (immutable).

`SavedView = { id: ID; label: string; order: Order; groupId?: ID; count?: number;
actions: readonly Action[] }`. A view stores no selected IDs, row data or grants.
The caller supplies the current view ID and `viewDirty`; core does not guess
equivalence from translated labels. A save request passes the current Order and
group ID to the caller; it is not called saved until refreshed props say so.

`DataListInput = { content: Content<readonly DataSection[]>; order: Order;
filters: readonly Filter[]; sort?: Sort; views: readonly SavedView[];
selectedViewId?: ID; viewDirty: boolean; saveView?: Action; groupId?: ID;
selection: 'none' | 'multiple';
selectedIds: readonly ID[]; collapsedIds: readonly ID[]; bulkActions: readonly
Action[]; page: Page; total?: number }`.
groupId is the caller's opaque grouping-strategy ID, not a DataSection ID; omitted
means ungrouped. The save control exists only when saveView is supplied, follows
its busy/disabled state and emits the current Order/groupId without persisting it.

| Component / layer | Props and events | Gallery cases; reference |
| --- | --- | --- |
| `ChoiceChips` / molecule | `model: ChoiceGroupModel`, `onChange(ID \| undefined)`; single selection, wrapping chips with radio/selected semantics. An optional clear control emits `undefined` only when not required. Derivation shares the choice decision with ChoiceRow. | `choice-chips/default`, `selected`, `disabled-option`, `required`, `long-labels`, plus pressed/focus; R10, R23. |
| `SelectionControl` / atom | `model: { label; selected: boolean \| 'mixed'; enabled; reason? }`, `onChange(boolean)`. Mixed activation selects all eligible loaded rows; selected activation clears them. | `selection-control/off`, `on`, `mixed`, `disabled`, plus pressed/focus; R02's selection affordance adapted to a native checkbox. |
| `ActionBar` / molecule | `model: { label; actions: readonly Action[] }`, `onAction(id)`. Preserve supplied order; wrap full labels; no nested pressable parent. | `action-bar/one`, `multiple`, `destructive`, `busy`, `disabled`, `long-copy`; R03, R09. |
| `DataList` / organism | `model: DataListModel`; `onOpen(rowId)`, `onRowAction(rowId,actionId)`, `onOrder(Order)`, `onView(id)`, `onViewAction(id,actionId)`, `onSaveView({order,groupId?})`, `onSelection(ids)`, `onCollapse(ids)`, `onBulkAction(actionId,ids)`, `onRefresh()`, `onMore()`. Only supplied controls are rendered. | `data-list/grouped`, `ungrouped`, `counts-unknown`, `collapsed`, `filtered-empty`, `inline-actions`, `saved-view`, `view-dirty`, `selection-none`, `selection-some`, `selection-all-loaded`, `selection-unavailable`, `paging`, `page-error`, `refresh-error`, plus common states; R02, R23. |

Selection is **loaded-row scope**, never “all results on the server.” The helper
intersects requested IDs with eligible loaded rows and emits them in section/row
order, with duplicates removed. Empty selection is valid. Changing filters,
sort, saved view or session clears selection in the screen before the new read;
paging in the same query preserves still-eligible selected IDs. A refreshed
disabled/deleted row is excluded from bulk targets with a visible correctable
selection notice. Bulk action eligibility is supplied for the full selection;
UI does not infer grants by intersecting row action labels. Bulk mutation atomicity
is the server capability's contract, not sequential hidden row requests.

Use inline actions in this delivery, which satisfies the brief's “swipe or inline”
choice. Every action is reachable without a gesture. Do not add a second swipe
gesture dependency just for the same controls. Keep list virtualization inside
ListScreen (extend it for grouped sections using native SectionList); do not nest
an unbounded list inside Screen. A row press opens; a checkbox/action press must
not also open it. Pagination callbacks are requests, with re-entry guarded by the
screen. Duplicate IDs across pages are `invalid-input` (immutable) at the adapter,
not last-wins data replacement.

## 1.3 — Detail sheet and side panel

`SurfaceInput = { open: boolean; title: string; subtitle?: string;
close: Action; dismissal: 'allowed' | 'confirm' | 'blocked'; reason?: string;
actions: readonly Action[]; contentState?: StateInput }`.
Confirm/blocked require a localized reason. Content is a React child slot; core
does not accept React nodes. `DetailRowsModel` uses the existing `detailItems`
rule; an optional Activity child is composed by the organism/screen.

| Component / layer | Props and events | Gallery cases; reference |
| --- | --- | --- |
| `DetailSheet` / template | `model: SurfaceModel`, `children`, `onAction(id)`, `onRequestClose('button' \| 'back' \| 'escape' \| 'gesture')`, `onPresented()`, `onClosed()`. The last two let the screen direct native focus to an existing trigger/fallback. | `detail-sheet/open`, `closed`, `long-content`, `sticky-actions`, `keyboard`, `dirty`, `busy`, `loading`, `empty`, `error`, `offline`; R03 and R15. |
| `SidePanel` / template | Same props/events as DetailSheet, plus `mode: 'modal' \| 'docked'`. Docked mode preserves list access and has no focus trap; modal mode excludes the background. The screen explicitly selects mode from its layout, using scale breakpoints. | `side-panel/docked`, `modal`, `long-content`, `sticky-actions`, `dirty`, `busy`, plus common states; R02. |

Both use the one DetailSurface scroll/header/footer layout and ActionBar. The
footer stays outside the content scroller, above safe area/keyboard, and its
measured height is reserved in content. A sheet is not another native header on
top of a screen header. Focus moves to the title/first meaningful control, not a
hidden drag handle. On actual close, restore the initiating row; if it disappeared,
use the screen-supplied list heading fallback.

`onRequestClose` is intent; the caller controls `open`. Confirm asks through the
existing dirty-form screen guard. Blocked keeps the sheet open and explains why.
Disable native swipe dismissal unless dismissal is allowed: native iOS close
notification can arrive after dismissal and therefore cannot enforce an unsaved
data guard. Android Back and keyboard Escape use the same callback. Compose the
existing native form-sheet stack where navigation owns presentation, or RN Modal
for a local overlay; do not mount both around the same content. Android's local
overlay has explicit Back/Close controls, not an invented iOS gesture guarantee.

## 1.4 — Timeline and audit list

Extend the existing Event/Activity display adapter with
`ActivityItem = { id: ID; occurredAt: Instant; verb: string; eventCode?: string;
actor: { kind: 'person'; id: ID; name?: string } | { kind: 'system' } |
{ kind: 'unknown' }; subject?: string; changes: readonly Change[];
details?: string; open?: Action }`.
`Change = { id: ID; label: string; before: AuditValue; after: AuditValue }`, where
`AuditValue = { kind: 'value'; text: string } | { kind: 'missing' } |
{ kind: 'redacted' }`. Empty string, missing and redacted are three different
values. `text` is already derived from a typed field by core; it is not arbitrary
HTML or a JSON payload dumped into the UI.

| Component / layer | Props and events | Gallery cases; reference |
| --- | --- | --- |
| `Activity` / organism | `model: ActivityModel` derived from content/page/expandedIds/excluded; `onExpand(ids)`, `onOpen(eventId)`, `onMore()`, `onRetry()`. The screen's existing events/names adapter delegates to deriveActivity with explicit Presentation. | `activity/person`, `system`, `unknown-actor`, `before-after`, `missing-value`, `redacted`, `expanded`, `excluded`, `same-time`, `older-loading`, `older-error`, plus common states; R17, R18. |

Core orders events by UTC occurredAt descending, then ID ascending for ties;
pagination preserves that order after validation. No actor lookup or fetch occurs
in a row. Actor IDs/names must already be authorized. The existing unknown payload
does not establish a before/after schema: omit changes when the capability has
not supplied typed changes. In particular, do not compare the current row with
an audit payload or interpret recursive `about()` matching as an authorization
boundary. Keep existing event reads and record attribution ownership unchanged.
Before/after values are immutable for this surface; no edit or undo is invented.

## 2.1 — Stepper

`Step = { id: ID; label: string; summary?: string; optional: boolean;
completion: 'incomplete' | 'complete' | 'skipped'; problems: readonly
{ fieldId: ID; message: string }[] }`.
`StepperInput = { steps: readonly Step[]; currentId?: ID;
phase: 'editing' | 'validating' | 'saving-exit' | 'submitting' | 'failed' |
'write-unknown' | 'finished'; issue?: Issue; saveAndExit?: Action;
finish: Action; dirty: boolean }`. Current ID is required for nonempty active
steps; zero steps is valid empty content with no Next/Finish. Finished is a
supplied confirmed outcome, not a result of reaching the last index.
Dirty derives a visible unsaved label and a confirm-dismissal descriptor for
the enclosing detail/form surface; it does not itself persist anything.

| Component / layer | Props and events | Gallery cases; reference |
| --- | --- | --- |
| `Stepper` / organism | `model: StepperModel`, `children` for current step content, `onNext()`, `onBack()`, `onGo(stepId)`, `onSkip()`, `onFinish()`, `onSaveAndExit()`, `onReconcile()`. Screen composes FormField controls derived by core in children. | `stepper/first`, `middle`, `last`, `one-step`, `empty`, `completed-step`, `optional-skipped`, `invalid`, `validating`, `saving-exit`, `save-failed`, `write-unknown`, `finished`, `long-labels`; R08. |

The pure step decision only determines adjacency, reachable prior steps and
progress. Progress is `(complete + skipped) / total`; its accessible description
also names the skipped count. Only optional steps may be skipped (`validation` —
correctable otherwise). Going back/reviewing a prior complete/skipped step is
allowed while editing; jumping ahead over an incomplete required step is refused
(`validation` — correctable). A Next activation requests caller validation; keep
the button available until that request begins, then busy. Validation failure
keeps the current step and exposes the first supplied field problem. Success
moves to the adjacent step via the same pure decision. Editing a prior step marks
that step and all subsequent completions incomplete; retained field values belong
to the caller. No dependency graph or workflow registry is introduced.

`stepTransition(input: StepperInput, event)` returns `Result<{ steps: readonly
Step[]; currentId?: ID }>`. Events are `{ kind: 'back' }`, `{ kind: 'go';
stepId: ID }`, `{ kind: 'skip' }`, `{ kind: 'edited'; stepId: ID }`, and
`{ kind: 'validated'; problems: readonly { fieldId: ID; message: string }[] }`.
Only editing/failed accepts navigation/edit events; validating accepts only
validated. Other phases refuse `busy` (correctable), except finished, which is
read-only (immutable). A validated failure replaces current problems without
moving; success clears them, marks complete and moves one position if a next
step exists. Final-step success stays on that step; only the caller's confirmed
finish response can set finished. Unknown IDs are invalid-input (immutable).
The screen calls this helper for outcomes and applies its returned state; UI
callbacks do not execute it independently or validate product fields.

Save-and-exit is a distinct write intent. Only a caller-confirmed save closes the
flow. Failure keeps the same draft and step; an uncertain write uses reconciliation
before repeat-save is possible. Screen hooks reuse the current dirty dismissal,
request generation and haptic patterns. The kit does not choose storage, autosave
intervals, resume identity or draft retention.

## 2.2 — Availability and slot picker

`Slot = { id: ID; start: Instant; end: Instant; state: 'open' | 'closed' |
'booked'; capacity: { kind: 'known'; total: number; remaining: number } |
{ kind: 'unknown' }; reason?: string }`.
Known counts are safe integers with `0 <= remaining <= total`; total zero is
valid no-capacity availability, not a schema error. Booked is a caller-supplied
display state and exposes no other actor's reservation identity.

`Availability = { slots: readonly Slot[]; availabilityVersion: ID;
validUntil: Instant }`.
`SlotPickerInput = { content: Content<Availability>; dates: readonly
LocalDate[]; selectedDate: LocalDate; selectedSlotId?: ID; quantity: number;
bookedLabel?: string }`.
Dates are nonempty, unique and ascending; selection must be inside them. Quantity is a
positive safe integer, supplied by the caller's party/quantity control. Version
is an opaque availability snapshot token, echoed in selection; it is not a lock.
Loading/error carries no invented snapshot version or expiry. Changing date
emits only onDate; the screen clears its selected slot before reading that date.

| Component / layer | Props and events | Gallery cases; reference |
| --- | --- | --- |
| `SlotOption` / molecule | `model: SlotOptionModel`, `onSelect(id)`. Model contains full date/time/offset, state, remaining/capacity text, selected marker and enabled/reason. | `slot-option/available`, `selected`, `full`, `closed`, `booked`, `unknown-capacity`, `past`, plus focus/pressed; R04, R05. |
| `SlotPicker` / organism | `model: SlotPickerModel`; `onDate(LocalDate)`, `onSelect({slotId, availabilityVersion, quantity})`, `onClear()`, `onRefresh()`. Selection is single and clearable; booking/confirm is a caller action, not an internal POST. | `slot-picker/date-strip`, `capacity-one`, `party-too-large`, `selected`, `selection-lost`, `booked`, `expired-snapshot`, `dst-repeat`, `no-slots`, plus common states; R04, R05. |

Core groups by slot start's LocalDate in the supplied zone, sorts start then ID,
and selects only `state=open`, `start > now`, fresh `now < validUntil`, known
remaining >= quantity. All other selections are `unavailable` (correctable).
Reason priority is booked, closed, past, expired snapshot, unknown capacity,
insufficient remaining. Booked remains visible/read-only (immutable for that
slot surface); the picker does not cancel or rebook it. Invalid start/end
(`end <= start`) or impossible counts are `invalid-input` (immutable).

Do not decrement remaining optimistically, reserve capacity, count overlapping
bookings or assume “unknown” means unlimited. A new snapshot/quantity re-derives
eligibility; a lost selection is visible, confirm is unavailable and no selection
callback fires during render. Selection callbacks echo the exact snapshot token;
the caller rechecks actor, tenant, expected revision and capacity in its server
transaction. Two callers can select the same last place locally; exactly-once
booking cannot be promised here. For instant picking outside supplied slots,
compose DateTimeRow with explicit initial instant, copy, zone and display
formatter; the slot picker never synthesizes availability from that control.

## 2.3 — Calendar

`CalendarEvent = { id: ID; title: string; subtitle?: string; status?: Status;
open?: Action } & ({ kind: 'timed'; start: Instant; end: Instant } |
{ kind: 'all-day'; startDate: LocalDate; endDate: LocalDate })`.
All-day endDate is exclusive. Dates/intervals must increase; timed and all-day
fields cannot be mixed. `CalendarInput = { content: Content<readonly
CalendarEvent[]>; view: 'day' | 'week' | 'agenda'; anchorDate: LocalDate;
selectedDate: LocalDate; selectedEventId?: ID; minDate?: LocalDate;
maxDate?: LocalDate; agendaEndDate: LocalDate; page?: Page }`.
Bounds are inclusive and agendaEndDate is exclusive. No recurrence, provider
calendar sync, staff/resource dimension or drag-to-reschedule is inferred.

| Component / layer | Props and events | Gallery cases; reference |
| --- | --- | --- |
| `DayStrip` / molecule | `model: DayStripModel`, `onDate(LocalDate)`, `onPrevious()`, `onNext()`, `onToday()`. Compose Button/Text atoms, not ChoiceChips. Seven civil days beginning at weekStartsOn; today and selected are independent. | `day-strip/current`, `selected-other-day`, `bounded`, `month-boundary`, `large-text`; R07. |
| `WeekCalendar` / organism | `model: WeekModel`, `onDate(LocalDate)`, `onEvent(id)`, `onMoreEvents({date,eventIds})`. Horizontal scrolling preserves usable day width; core supplies segments/lanes. | `week-calendar/default`, `overlap`, `adjacent`, `overnight`, `all-day`, `dst-short`, `dst-long`, `dense`, plus common states; R06. |
| `AgendaList` / organism | `model: AgendaModel`, `onEvent(id)`, `onRefresh()`, `onMore()` when supplied. Compose DataList/ListScreen with day headings and explicit zero-event days. | `agenda-list/day`, `range`, `empty-day`, `mixed-all-day`, `status`, plus common states; R07. |
| `Calendar` / organism | `model: CalendarModel`; `onDate(LocalDate)`, `onEvent(id)`, `onMoreEvents({date,eventIds})`, `onRefresh()`, `onMore()`, `onView('day' \| 'week' \| 'agenda')`, `onNavigate({startDate,endDate,selectedDate})`. The composed view owns no requests. | `calendar/day`, `week`, `agenda`, `view-change`, `range-loading`, `selected-missing`; R06, R07. |

Core expands the requested civil days using Temporal and intersects timed
intervals with each day's actual UTC boundaries. At midnight, an exclusive end
does not create a second-day event. Long events have one segment per intersected
day with the same event ID and a derived continuation label. All-day entries
precede timed entries; timed entries sort by start, end, then ID.

The week timetable uses an elapsed-minute axis **per day**, not a fictitious
24-hour wall-clock axis shared across DST changes. Ticks show local time; repeated
hours include their UTC offsets, and skipped hours are absent. Overlapping
segments use interval lanes: start/end/ID ordering, smallest free lane with
`previousEnd <= nextStart`, and each connected overlap group uses its maximum
concurrent lane count. Adjacent events can share a lane. When measured targets
would overlap at the scale's minimum hit size, derive a labelled “more events”
control for that group; its sheet lists all those event IDs in the same order.
The full agenda remains an equally operable alternative.

Day view renders the selected civil day with the same segment/lane projection;
week view renders the seven days containing anchorDate; agenda covers
`[anchorDate, agendaEndDate)`. Navigation moves the anchor by seven civil days
for the strip/week, one for day, and the current civil-day range length for
agenda. Today selects today's date and its containing range. The composed
Calendar emits only `onNavigate` for a range navigation, only `onDate` for a date
selection within that range, and only `onView` for a view switch; it does not
also emit child navigation callbacks. Models carry the next range/date targets
so UI does not redo civil arithmetic. The caller updates controlled inputs and
starts the relevant read. Navigation preserves the selected date's offset within
the range; Today selects today's date. If that target date is outside the
inclusive bounds, the navigation action is unavailable (correctable), with no
silent clamping. Agenda paging is offered only when Page is supplied.

Changing view preserves selected date/event only if still present; Today uses
Presentation.now in its zone. Out-of-bounds date selection is `unavailable`
(correctable); invalid bounds are `invalid-input` (immutable). A missing
controlled event ID uses the common invalid-selection state. No event becomes
overdue merely because the UI recognizes a status name;
the caller supplies any domain due/overdue classification.

## 3.1 — Product, price and cart

`PriceInput = { amount: Money; compareAt?: Money; qualifier?: string;
kind: 'price' | 'estimate'; unitLabel?: string }`. CompareAt is optional supplied
reference pricing in the same currency; it must be >= amount. It is not used to
calculate a discount. Qualifier/unit labels are explicit copy, not a recurring
billing or quantity rule inferred from text.

`QuantityInput = { value: number; min: number; max: number; step: number;
state: 'ready' | 'disabled' | 'busy'; reason?: string; label: string }`.
Disabled requires a reason; busy suppresses all adjustments. All numbers are safe
integers, `1 <= min <= max`, `step >= 1`, and an eligible value satisfies
`min <= value <= max` and `(value-min) % step == 0`. Out-of-range current values
show a correctable field problem, not a silently clamped purchase quantity.
The +/- targets derive from the same bounds. Zero is not shorthand for remove.

`Product = { id: ID; title: string; description?: string; price: PriceInput;
status?: Status; availability: 'available' | 'sold-out' | 'unavailable';
reason?: string; imageId?: ID; open?: Action; primary?: Action }`.
`OptionGroup = ChoiceGroup`; a caller supplies one group per option dimension,
already marking impossible combinations unavailable. Core never constructs a
product variant matrix from its labels. `ProductCardInput = { content:
Content<{ product: Product; options: readonly OptionGroup[];
quantity?: QuantityInput }> }`. Before a valid price arrives, loading/error
content replaces the purchase controls; the card never presents a guessed price.

`CartLine = { id: ID; productId: ID; title: string; optionsText?: string;
unitPrice: Money; quantity: QuantityInput; availability: 'available' |
'sold-out' | 'unavailable'; reason?: string; remove?: Action; open?: Action }`.
Lines have their own IDs; the same product may occur with different options.
The kit does not merge lines by product ID. `Adjustment = { id: ID; label: string;
amount: Money }` is a signed, already-computed amount (such as a charge or credit),
not a rate or a tax rule.

`Quote = { id: ID; revision: ID; expiresAt: Instant; total: Money }` is optional
authoritative evidence supplied by a capability. `CartInput = { content:
Content<readonly CartLine[]>; currency: Currency; adjustments: readonly
Adjustment[]; quote?: Quote; checkout: Action }`.
`SummaryInput = { lines: readonly { id: ID; label: string; amount: Money }[];
adjustments: readonly Adjustment[]; currency: Currency; quote?: Quote;
kind: 'estimate' | 'quote' | 'receipt' }`.
Quote kind requires Quote; receipt is caller-confirmed, read-only and need not
remain within a quote expiry window. Empty cart is valid and has zero subtotal.

| Component / layer | Props and events | Gallery cases; reference |
| --- | --- | --- |
| `Price` / atom | `model: PriceModel`, no events. Full exact value and currency/unit accessible name; optional compare-at and estimate label. | `price/zero`, `fraction`, `large-int64`, `negative`, `compare-at`, `estimate`, `zero-decimal`, `three-decimal`; R09, R22. |
| `QuantityControl` / molecule | `model: QuantityModel`, `onChange(quantity)`. Native adjustable semantics plus explicit labelled +/- buttons use the same core-derived targets. No freeform numeric editor is added in this slice. | `quantity-control/min`, `middle`, `max`, `step`, `invalid`, `disabled`, `busy`; R05, R10. |
| `ProductCard` / organism | `model: ProductCardModel`, optional `image: ReactNode` supplied by screen, `onOpen(productId)`, `onAction(productId,actionId)`, `onOption(groupId,choiceId: ID \| undefined)`, `onQuantity(number)`. The image slot is decorative within the named product, is omitted without imageId and cannot contain a second purchase control. | `product-card/default`, `no-image`, `options`, `selected-option`, `required-option`, `quantity`, `sold-out`, `price-loading`, `price-error`, `unavailable`, plus common states; R09, R10. |
| `BuyBar` / template | `model: BuyBarModel` containing PriceModel, Action and optional quantity/notice text; `onAction(actionId)`. Compose Price/Notice atoms and ActionBar; the shared canvas footer layout fixes it above safe area/keyboard. It does not acquire navigation or domain state. | `buy-bar/default`, `quantity`, `busy`, `disabled`, `quote-expired`, `long-copy`, `keyboard`; R09. |
| `Cart` / organism | `model: CartModel`, `onQuantity(lineId,quantity)`, `onRemove(lineId)`, `onOpen(lineId)`, `onCheckout({quoteId,revision})`, `onRefresh()`. Checkout callback only exists for a fresh valid quote; an estimate can expose a separate refresh/quote action. | `cart/one-line`, `multiple-lines`, `same-product-different-options`, `empty`, `sold-out-line`, `quantity-conflict`, `estimate`, `quote-expired`, `mixed-currency-error`, `overflow-error`, `checkout-busy`, `write-unknown`, plus common states; R09, R22. |
| `OrderSummary` / organism | `model: SummaryModel`, no mutation events; optional caller action goes through an enclosing ActionBar. | `order-summary/estimate`, `quote`, `receipt`, `discount`, `charge`, `zero-total`, `total-mismatch`, `long-labels`, plus common loading/error wrapper; R22. |

`cartTotals` computes each line `unitPrice.minor * quantity`, then subtotal and
the signed adjustments, all in bigint. All units, adjustments and quote totals
must share the exact currency/exponent pair. Validate each line total and every
published subtotal/final total against int64; input order must not decide whether
cancelling adjustments overflow an intermediate accumulator. No rounding occurs
in this arithmetic. Negative unit prices or a negative purchase total are
`invalid-input` (immutable for this purchase snapshot); credit/refund workflows
may display signed Price values but need their own capability semantics.

A quote total differing by even one minor unit from the displayed line/adjustment
sum is `invalid-input` (immutable): show a mismatch notice, no checkout, no
plausible partial total. An expired quote (`now >= expiresAt`), missing required
option, unavailable line or changed quantity is `unavailable` (correctable):
request a fresh quote. The screen removes its quote immediately on a
lines/options/quantity change, before awaiting a new quote. Core can check totals
and expiry; it cannot infer a quote's binding to changed options from equal money
amounts. The authoritative capability must verify that binding at checkout.
Quote-free totals are labelled estimates. A last-line removal is permitted by
the presentation contract and produces an empty cart; it is not a generic
“last remaining administrator” rule. The server owns inventory, prices, payment,
order revision, checkout idempotency and the resulting receipt.

## 3.2 — Pricing tiers and plan comparison

`BillingPeriod = { id: ID; label: string }` is opaque (no hardcoded monthly/yearly
semantics). `Feature = { id: ID; label: string; description?: string }`.
`FeatureValue = { kind: 'included' | 'excluded' | 'unknown' } |
{ kind: 'text'; text: string }`.
`Plan = { id: ID; title: string; description?: string; badge?: Status;
offers: readonly { periodId: ID; price: PriceInput | { kind: 'contact'; label:
string }; action?: Action }[]; features: Readonly<Record<ID,FeatureValue>> }`.
All feature keys must belong to the supplied feature list; an omitted feature
means unknown, never excluded. Duplicate offers for a period are invalid.

`PricingInput = { content: Content<readonly Plan[]>; periods: readonly
BillingPeriod[]; selectedPeriodId: ID; selectedPlanId?: ID; currentPlanId?: ID;
features: readonly Feature[] }`. A plan lacking the selected period has no offer
and a localized unavailable explanation; do not multiply a different period's
price. Current and selected have independent meanings.

| Component / layer | Props and events | Gallery cases; reference |
| --- | --- | --- |
| `PricingTiers` / organism | `model: PricingModel`, `onPeriod(id)`, `onSelect(planId)`, `onAction({planId,periodId,actionId})`, `onRetry()`. Vertical cards on phone, wrapping comparison on wide layouts; preserve supplied plan order. | `pricing-tiers/default`, `one-plan`, `current`, `selected`, `recommended`, `free`, `contact`, `period-switch`, `missing-offer`, `busy`, `long-copy`, plus common states; R11. |
| `PlanComparison` / organism | `model: PlanComparisonModel` derived from the same PricingInput; same callbacks. Feature rows in supplied order; each native accessible row reads feature, plan name and explicit value together. | `plan-comparison/included`, `excluded`, `unknown`, `text-value`, `many-features`, `narrow`, `large-text`, plus common states; R11. |

No entitlement decision, trial period, proration, “save X%”, specialist quota or
recommended plan is inferred. A current plan may have a supplied manage action;
the component never turns selection into an upgrade automatically. Unsupported
structural IDs/shapes are `invalid-input` (immutable); unavailable period/offer selection is
`unavailable` (correctable). Durable subscription changes remain with the caller.

## 4.1 — Map, list toggle and selected-item sheet

`MapPoint = { id: ID; longitude: number; latitude: number; title: string;
subtitle?: string; status: Status; open?: Action; actions: readonly Action[] }`.
Coordinates are finite WGS 84 longitude in [-180,180] and latitude in [-90,90].
No location is inferred from an address and missing location is not `(0,0)`.
`Viewport = { longitude: number; latitude: number; zoom: number }` has finite
zoom in [0,22]. Bearing/pitch stay zero for this surface. Geographic coordinates
outside a provider's supported projection remain visible in the list with an
explicit unsupported-location reason; they are not silently moved on the map.

`MapCapabilities = { latitudeBounds: readonly [number,number];
zoomBounds: readonly [number,number] }` comes from the explicit native adapter.
Bounds are finite/increasing and within the geographic/zoom limits above. Core
excludes points outside that latitude interval from markers, labels them
unsupported in the list, and disables viewport targets outside the supplied
zoom interval. It does not implement the provider's projection mathematics.

`MapInput = { content: Content<readonly MapPoint[]>; mode: 'map' | 'list';
selectedId?: ID; viewport: Viewport; legend: readonly Status[];
capabilities: MapCapabilities;
providerState: 'loading' | 'ready' | 'offline' | 'error' | 'unsupported';
providerMessage?: string; attribution: string }`. Legend entries are unique by
their label/tone/symbol tuple; all point status tuples must be represented.

| Component / layer | Props and events | Gallery cases; reference |
| --- | --- | --- |
| `MapLegend` / molecule | `model: { title: string; entries: readonly Status[] }`, no events. Text/symbol accompanies every status colour. | `map-legend/default`, `long-labels`, `same-tone-different-symbol`; R14. |
| `MapWithList` / organism | `model: MapModel`; `renderMap(MapCanvasProps): ReactNode`; `renderDetail(pointId): ReactNode`; `onMode('map' \| 'list')`, `onSelect(id)`, `onRevealPoints(ids)`, `onClearSelection()`, `onViewport(Viewport)`, `onAction(pointId,actionId)`, `onRetry()`. MapCanvasProps is defined below and contains no SDK type. | `map-with-list/points`, `list`, `selected`, `same-coordinate`, `out-of-projection`, `empty`, `provider-offline`, `provider-error`, `provider-unsupported`, `stale-points`, `selected-removed`, `large-text`; R14, R15. |

`MapCanvasProps = { markers: readonly { id: ID; longitude: number; latitude:
number; label: string; status: Status; selected: boolean }[]; viewport: Viewport;
attribution: string; motion: 'none' | 'normal'; onMarker(id): void;
onViewport(Viewport): void }`. The shared native screen adapter binds this port
explicitly to `@maplibre/maplibre-react-native` v11. It consumes provider resources
prepared by `src/effects/` and reports native load/error events to screen state.
Domain HTTP still uses the shell Api; map tile/style resource loading is owned
by that explicit provider adapter, never by MapWithList or core. Do not put an
SDK instance or process-global access token in ThemeProvider or a UI registry.

The product chooses its tile/style provider, permitted endpoints, attribution,
licensing and any scoped credentials in effect configuration. The shared adapter
does not ship a production tile endpoint, geocoder, route planner, GPS watcher or
background tracker. Styling of kit-owned points/controls uses theme roles only;
provider basemap artwork is supplied content, like a photograph. It does not
authorize a second palette for the kit's chrome. Screen composition must release
scoped provider resources on session change and prevent a later native callback
from restoring them.

Toggle keeps the same selected ID and viewport. List and map activation select
the same item and open the same DetailSheet; there is no second point-data cache.
Selection of an absent ID is `unavailable` (correctable). Core coalesces exact
same-coordinate points into one marker, using the lexically smallest point ID
as its stable marker ID (numeric -0 and 0 are equal). A one-point marker retains
that point's status; a multi-point marker has neutral status and a localized
count/name. The model maps marker activation either to onSelect for one point
or onRevealPoints for its IDs in input order. The latter asks the screen to
show the shared list/detail surface for those IDs; it never guesses which one
was intended. Full list mode still exposes every point and its original status.
This is exact-coordinate disambiguation, not a new geographic clustering engine.
Map mode is not the only
keyboard/screen-reader path; zoom controls and the complete list are available.
For zero points, retain the supplied viewport and honest empty-state action; do
not invent a default city or request device location. A provider failure leaves
list mode usable and shows the provider reason. No native clustering or bounds
rule is reimplemented in a product.

## 4.2 — Media

`MediaItem = { id: ID; width: number; height: number; description: string;
caption?: string; decorative: boolean; state: 'loading' | 'ready' | 'error' |
'unavailable'; reason?: string }`. Dimensions are positive finite integers.
Dimensions must also be safe integers. Informative/interactive items require a nonempty description; decorative items
must have no image activation. Captions do not substitute for an accessible name.
MediaItem contains no credential, cookie, upload command or remote response body.

`MediaInput = { content: Content<readonly MediaItem[]>; selectedId?: ID;
page: Page }`. An item keeps its ID while its independently loaded image changes
state; that load state never signals domain write success.

Opening a thumbnail requires ready, nondecorative media. Once a viewer is open,
the selected ID remains valid through loading, error and unavailable states while
the item exists and is nondecorative. Loading keeps its image adapter mounted;
error and unavailable expose that item's retry action. Only a removed or
decorative selected item produces the viewer's selection-unavailable notice.

| Component / layer | Props and events | Gallery cases; reference |
| --- | --- | --- |
| `MediaHero` / molecule | `model: { item: MediaItemModel; title?: string; subtitle?: string; action?: Action }`, `renderImage(ImageSlotProps): ReactNode`, `onOpen(id)`, `onAction(id)`, `onRetry(id)`. Full-bleed media with readable content below or on a theme-backed surface; never unmeasured text contrast directly over an arbitrary image. | `media-hero/default`, `portrait`, `landscape`, `decorative`, `loading`, `error`, `unavailable`, `long-copy`; R13. |
| `PhotoGallery` / organism | `model: MediaModel`, same image slot, `onOpen(id)`, `onMore()`, `onRetry(id)`. Thumbnail order is caller order; a selected item opens the common PhotoViewer. | `photo-gallery/one`, `many`, `mixed-ratios`, `selected`, `item-loading`, `item-error`, `paging`, plus common states; R12, R13. |
| `PhotoViewer` / organism | `model: ViewerModel` derived from MediaInput plus `open: boolean`, `renderImage(ImageSlotProps): ReactNode`, `onSelect(id)`, `onClose()`, `onRetry(id)`. Previous/next/close/zoom controls have explicit derived labels and disabled limits. | `photo-viewer/first`, `middle`, `last`, `one`, `zoomed`, `pan`, `load-error`, `selected-removed`, `reduced-motion`, `keyboard`; R13 image focus and R12 collection order, an explicit full-screen adaptation. |
| `MasonryWall` / organism | `model: MediaModel`, same image slot, `columns: 1 \| 2 \| 3`, `onOpen(id)`, `onMore()`, `onRetry(id)`. Screen chooses columns using scale and text size. | `masonry-wall/one-column`, `two-columns`, `three-columns`, `mixed-ratios`, `recycled-item`, `paging`, `item-error`, plus common states; R12, R19. |

`ImageSlotProps = { id: ID; description: string; decorative: boolean;
fit: 'cover' | 'contain'; aspectRatio: number }`. A shared native image adapter
in the screen layer binds IDs to effects-resolved sources using the SDK-pinned
`expo-image`; UI receives the render slot and item state. It cannot fetch a URL
or attach auth headers. Effects own source authorization, refresh, cancellation
and resource/cache lifetime. The adapter defaults to no persistent caching of
session-scoped media; a product opting into caching must partition it by server,
tenant, actor and media version and clear it on scope loss. A changed source must
not briefly show a recycled item's previous bytes.

Hero/thumbnails use cover; viewer uses contain and respects orientation. Never
scale a skeleton with a guessed aspect ratio when valid dimensions were supplied.
Masonry uses FlashList v2's masonry layout with `optimizeItemArrangement=false`;
screen-reader traversal remains source order, with a one-column alternative.
No new masonry packing engine is written in core or a product.

Viewer selection is controlled by ID; it resets zoom for another ID and returns
focus to its thumbnail, or the gallery heading if removed. Its native gesture
adapter must implement pinch/pan with equivalent labelled zoom/reset/next/previous
controls. Compose `react-native-zoom-toolkit` ResumableZoom inside the existing
native modal layout; use its gesture/zoom implementation and keep the shared
Button/ActionBar chrome. Do not implement pinch mathematics or adopt a viewer
that takes ownership of copy/theme/selection. No SDK-specific index escapes this
adapter. PhotoViewer passes the derived aspect ratio through `ZoomSlotProps`.
The adapter measures the available viewing area and uses the toolkit's
`fitContainer` to give its child a numeric width, including after layout changes.
`MediaHero` accepts an optional `renderFrame(frame)` slot that fills the available
height while keeping captions and retry controls outside the zoomed image.
Zoomed content is clipped to the viewing area so navigation remains reachable.
A missing
image/source is `unavailable` (correctable by reload); invalid dimensions or
duplicate identities are `invalid-input` (immutable). If the selected item is
removed during viewing, show unavailable and Close; never silently open the next
person's image. No video, capture, upload, editing or automatic download is implied
by this photo presentation contract.

## 4.3 — Charts and stat tiles

`Point = { id: ID; x: number; y: number | null }`.
`Series = { id: ID; label: string; tone: 'neutral' | 'info' | 'ok' | 'warning' |
'danger'; points: readonly Point[] }`.
`ChartInput = { content: Content<readonly Series[]>; xKind: 'number' | 'time';
xLabel: string; yLabel: string; unitLabel: string; fractionDigits: number;
domain?: { x: readonly [number,number]; y: readonly [number,number] };
ranges: readonly { id: ID; label: string }[]; selectedRangeId?: ID;
selectedPoint?: { seriesId: ID; pointId: ID } }`.
Time x is an integer UTC epoch millisecond within the Instant range. Numeric x/y
are finite. fractionDigits is an integer from 0 through 6. Null y is missing,
never zero. Up to four explicitly named series are supported in this first
surface; more is `unsupported-format` (immutable), with no silent truncation.

`BarData = { categories: readonly { id: ID; label: string }[];
series: readonly { id: ID; label: string; tone: Series['tone']; values:
Readonly<Record<ID,number | null>> }[] }`.
`BarInput = { content: Content<BarData>; xLabel: string; yLabel: string;
unitLabel: string; fractionDigits: number; yDomain?: readonly [number,number];
ranges: readonly { id: ID; label: string }[]; selectedRangeId?: ID;
selectedCategoryId?: ID }`. Categories are ordered. Each occurs once per series;
missing category values are null. Bars are grouped, not stacked; one shared zero
baseline and category order are used across series. `StatInput = { label: string;
value: number | Money; comparison?: number | Money; fractionDigits: number;
unitLabel?: string; preference: 'higher' | 'lower' | 'neutral' }`.
Comparison must have the same type and, for Money, currency. Stat preference
determines whether an increase is favourable; positive is not automatically good.

| Component / layer | Props and events | Gallery cases; reference |
| --- | --- | --- |
| `Sparkline` / molecule | `model: SparklineModel` from ChartInput constrained to at most one Series, no ranges/selection; no events. Full derived accessible summary; no hidden gesture-only data. | `sparkline/rising`, `falling`, `flat`, `zero`, `one-point`, `gap`, `empty`, `invalid`; R20, R21. |
| `AreaChart` / organism | `model: ChartModel`, `onRange(id)`, `onPoint({seriesId,pointId})`, `onClearPoint()`, `onRetry()`. Range controls and accessible data rows are composed from ChoiceChips/Row. | `area-chart/default`, `range`, `multiple-series`, `selected-point`, `gaps`, `negative`, `constant`, `one-point`, `range-loading`, `invalid-domain`, plus common states; R24's plot/range frame, explicitly extended to an area. |
| `BarChart` / organism | `model: BarModel`, `onCategory(categoryId)`, `onRange(id)`, `onRetry()`. Every category/value is also a readable row; selecting a bar is optional if no callback/control is supplied. | `bar-chart/default`, `grouped`, `negative`, `zero`, `missing`, `long-labels`, `selected`, `invalid`, plus common states; R24's plot and KPI hierarchy, explicitly extended to bars. |
| `StatTile` / molecule | `model: StatModel`, no events; an optional enclosing action is separate. Main value, signed absolute delta, percent delta when defined, comparison label and direction symbol. | `stat-tile/value`, `increase`, `decrease`, `unchanged`, `zero-baseline`, `money`, `neutral`, `lower-is-better`, plus common loading/empty/error wrapper; R16, R20, R24. |

Core validates unique point IDs and strictly increasing x **within each series**;
it refuses duplicates/unsorted points (`invalid-input` — immutable) instead of
averaging or sorting time samples behind the caller. Ranges are caller-supplied
data requests, not magic duration strings or client-side aggregation.

Without an explicit domain, x spans all finite samples. A single x expands to
`[x-1,x+1]` (one millisecond for time). Line y spans finite nonnull samples; a
constant v expands by `max(abs(v)*0.1,1)` on both sides. Area and bar y include
zero before that constant-domain rule. Empty/all-null values render empty, not
a zero line. Explicit domains must be finite, increasing and include all plotted
samples and the zero baseline for area/bar; otherwise `invalid-input` (immutable),
with no clipping that conceals data. Refuse arithmetic that makes derived bounds
nonfinite or non-increasing, including precision loss at extreme Number values
(`invalid-input` — immutable). D3 linear scales map to normalized `[0,1]`, with y inverted for display;
UI applies measured layout/scale dimensions and does not recompute the domain.

Use D3's defined-value handling to split paths at null values; never bridge a
missing interval. Use linear segments, no invented smoothing or downsampling.
One finite point is a labelled dot, not a trend. Bars end at zero. Derived tick
labels and selected-point text use the same explicit locale/unit formatter;
graphics use theme roles plus distinct line/marker patterns. The data table is
the keyboard/screen-reader path to every plotted value; focus and touch selection
both name a stable sample ID. Financial settlement totals must use Money, not a
chart's approximate Number coordinates.

Stat absolute delta is current minus comparison. Percent is
`100 * (current-comparison) / abs(comparison)`; for zero comparison it is undefined
and labelled “no baseline,” including zero-to-zero. Money delta uses bigint;
an absolute delta outside int64 is `invalid-input` (immutable), not a wrapped or
rounded monetary value. Number deltas must remain finite.
percent rounding is half away from zero to one decimal place, without converting
an int64 amount to Number. Number stats use the stated display precision and the
same one-decimal percent presentation. Never display Infinity, NaN or a red/green
meaning without the preference and a direction label.

## Explicit factories and source migration

Models are opaque **to consuming apps**: obtain them from these core functions;
do not construct or persist them, cast raw HTTP data to them, or use their private
layout fields as a domain API. Their TypeScript types are exported for component
props. The stable app API is the input shape, the result/refusal, the callbacks
and the observable behavior specified here. UI implementations can read the
owned model fields within the shared package. This keeps display rules in one
owner without demanding that a product assemble a second view model.

| Function in `core/derive` | Input and result contract |
| --- | --- |
| `deriveCopy` | `'en' \| 'pt'` → Copy; complete bundles with the coverage and phrases above. An unsupported language is unsupported-format (immutable). |
| `deriveState` | StateInput + Presentation → StateModel; branches choose existing state atoms. |
| `deriveChoices` | ChoiceGroup + Presentation → ChoiceGroupModel, also usable by the existing ChoiceRow adapter. |
| `deriveSelection` | `{ label; selected: boolean \| 'mixed'; enabled; reason? }` + Presentation → SelectionModel. |
| `deriveActions` | `{ label; actions: readonly Action[] }` + Presentation → ActionBarModel. |
| `deriveDataList` | DataListInput + Presentation → DataListModel; catalog adapter delegates existing Order/cell/value decisions. |
| `deriveSurface` | SurfaceInput + Presentation → SurfaceModel; no child content/React node enters core. |
| `deriveActivity` | `{ content: Content<readonly ActivityItem[]>; page; expandedIds; excluded }` + Presentation → ActivityModel. |
| `deriveStepper`, `stepTransition` | StepperInput + Presentation → StepperModel; stepTransition uses the exact events/results above. The adjacent-step decision is shared by screen and test harness; it does not store drafts. |
| `deriveSlots` | SlotPickerInput + Presentation → SlotPickerModel, including SlotOptionModel for each ID. |
| `deriveCalendar` | CalendarInput + Presentation → `{ calendar: CalendarModel; strip: DayStripModel; week: WeekModel; agenda: AgendaModel }`; each view consumes a projection of the same day/event decision. |
| `derivePrice`, `deriveQuantity`, `deriveProductCard` | Corresponding named input + Presentation → PriceModel, QuantityModel, ProductCardModel. |
| `cartTotals` | `{ lines: readonly { id; unitPrice: Money; quantity: number }[]; adjustments; currency }` → exact subtotal/line totals/total or classified issues; no presentation, clock or I/O needed. |
| `deriveCart`, `deriveSummary` | CartInput or SummaryInput + Presentation → CartModel or SummaryModel, using cartTotals/the same exact sum helper. |
| `deriveBuyBar` | `{ price: PriceInput; action: Action; quantity?: number; notice?: StateInput }` + Presentation → BuyBarModel. |
| `derivePricing` | PricingInput + Presentation → `{ tiers: PricingModel; comparison: PlanComparisonModel }`. |
| `deriveMap` | MapInput + Presentation → `{ map: MapModel; legend: MapLegendModel }`; native camera/projection remains the provider's owner. |
| `deriveMedia` | MediaInput + Presentation → MediaModel for collection/wall. |
| `deriveMediaHero` | `{ item: MediaItem; title?; subtitle?; action? }` + Presentation → MediaHeroModel. |
| `deriveViewer` | MediaInput + `{ open: boolean }` + Presentation → ViewerModel, including selected position and boundary controls. |
| `deriveSparkline`, `deriveChart`, `deriveBars`, `deriveStat` | Corresponding chart/stat inputs + Presentation → SparklineModel, ChartModel, BarModel, StatModel; one scale/value decision is shared. |

All model factories return Result; deriveCopy returns its immutable bundle
directly as described above. Success payloads in the table may contain multiple
named projections. These are named functions, not a generic
component factory, runtime renderer registry or schema/code generator. Existing
core functions may accept explicit formatting/copy options and delegate to these
owners; aliases cannot retain a second rule.

Each migration slice must spell the source compatibility change before editing callers:
the required clock/copy inputs cannot preserve UI defaults that read the clock
or embed English. `DateTimeRow` gains required `initialValue: Date`, `timeZone:
string` and a derived copy object (`set`, `clear`, `notSet`, `openHint`), preserving
its existing label/value/onChange/text/disabled/required/testID props. Clear is
unavailable when disabled or required. Native chooser locale follows supported
OS behavior; surrounding labels and formatted values use Presentation, and no
test claims to force the Android OS dialog's language. Activity's raw events/names
and optional now props move to its screen/core adapter; Activity itself receives
only the proposed model and callbacks. Presentation.now is required there, so
the old component clock default is removed. `Skeleton`/`Spinner` require
derived loading labels; ChoiceRow requires derived placeholder, cancel and hint
copy. Migrated generated screens receive Presentation from screen composition.

These additions are deliberate **source-breaking props changes** for those
direct consumers, with all in-repository consumers, Gallery and tests migrated
in the same slice. Preserve export paths/names, document the new required props
for apps updating their exact source pin, and do not claim compatibility with
unmigrated external apps. Existing resource CRUD, order/filter wire spelling,
renderer-pack lookup and catalog-version behavior are unchanged. Product-specific
field/noun translations enter through explicit labels at the core derivation
boundary; a missing translation displays the supplied label/identifier, not an
invented Portuguese inflection.

## OSS choices and native dependency gate

The locked foundation remains Expo 57.0.23, React Native 0.86.3, React 19.2.3,
the native pickers, safe-area context, screens and Reanimated/Worklets. Versions
below are specification candidates read on 2026-09-29, **not new lockfile pins
or successful native compatibility tests**. Implementation uses the installed
Expo manifest for SDK-managed packages, then records exact resolved versions,
licenses and build evidence. No version is inferred from a screenshot or a peer
dependency wildcard.

| Area | Selection, evidence and reason |
| --- | --- |
| States, lists, controls, stepper, product, plans, audit | Existing React Native primitives and shared components. These are presentation compositions, not replacements for a missing OS capability. Adding a separate component suite would duplicate theme, form and action owners. Native FlatList/SectionList preserve the existing virtualized list owner. |
| Sheets/panels | Existing screens/navigation presentation and [React Native Modal](https://reactnative.dev/docs/0.86/modal), with the shared canvas/action layout. A new bottom-sheet dependency is not needed for the specified modal/docked modes. Disable unsafe gesture dismissal in dirty/busy states; native defaults alone do not prove focus or keyboard behavior. |
| Time/calendar | [Temporal polyfill](https://github.com/js-temporal/temporal-polyfill), candidate 0.5.1, imported without global installation, and Intl. [React Native Calendars](https://wix.github.io/react-native-calendars/docs/Intro) was considered, but a month-picker/agenda integration would still require the specified pure interval/overlap decision and explicit copy/zone adaptation. Reuse the existing native date input; compose the three required views over one core model instead of introducing another calendar state owner. |
| Money | ECMAScript bigint and Intl. The owned operation is exact integer addition/multiplication and formatting, not pricing/tax/FX. A commerce SDK would not make server quotes authoritative and would add irrelevant domain policy. The independent overflow/currency cases remain required. |
| Map | [MapLibre React Native](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/), candidate 11.4.0. Its documented lower bounds (RN >=0.80, Expo >=54, React >=19.1, New Architecture) include this manifest's versions; that is a metadata match, not a device pass. Use the documented Expo config plugin and rebuild; product tile service details stay in its effect configuration. |
| Image/masonry | Expo Image `~57.0.5` and FlashList `2.0.2` are the installed Expo 57 bundled manifest's recommendations. [FlashList masonry](https://shopify.github.io/flash-list/docs/guides/masonry/) supplies packing/recycling; turn off item rearrangement. No bespoke masonry layout or image loader. |
| Photo zoom/viewer | [React Native Zoom Toolkit](https://glazzes.github.io/react-native-zoom-toolkit/components/resumablezoom.html), candidate 5.1.1, with SDK-aligned Gesture Handler `~2.32.0` and the existing Reanimated/Worklets. Compose ResumableZoom, RN Modal and the existing controls. [Galeria](https://github.com/nandorojo/galeria) 3.0.3 was evaluated through its published README: native gestures and index events fit, but its documented viewer API does not establish controlled closing, all labels, full token chrome and reduced-motion overrides. That unproven surface is why it is not selected; do not fork it to obtain another design system. |
| Chart geometry/drawing | [d3-scale](https://github.com/d3/d3-scale) and [d3-shape](https://d3js.org/d3-shape/line) in core, with Expo-pinned [react-native-svg](https://docs.expo.dev/versions/latest/sdk/svg/) `15.15.4` for rendering. Explicitly use linear scales/segments and missing-value gaps. [Victory Native](https://github.com/FormidableLabs/victory-native-xl) was evaluated; its Skia/gesture/animation stack and component-owned geometry are unnecessary for these bounded chart forms. Pure D3 keeps one scale decision usable in Node and native rendering. |

Before landing a dependency-using slice: install at the application root with
the existing Expo workflow, retain a single native dependency instance, verify
the package consumer imports/bundles, record the native fingerprint change and
build with the one `make apk` / `scripts/android/build.sh` recipe. Prove Android
and iOS load/gesture/accessibility behavior on the locked stack. If the selected
library cannot meet the contract, that slice is blocked pending a concrete
replacement decision and its reuse paragraph; do not quietly fork a library,
weaken ESLint or substitute an untested native package. This is an implementation
compatibility gate, not a product policy decision left unspecified.

## Visual reference register

Each linked Mobbin image was inspected from the supplied review's local copy.
Use the named section as the reference for hierarchy and behavior; adapt it to
native targets, accessibility and the supplied palette. A web screenshot does
not prove a native gesture, another state, a second theme or pixel parity. No
reference image, account content or product-specific fixture is copied into the
public source. The phase report records the existing file paths and hashes.

| ID | Public reference and inspected section | Native answer / evidence limit |
| --- | --- | --- |
| R01 | [CLEAR empty home](https://mobbin.com/screens/f064d2a4-fe6c-4b24-b032-e7545aa28a4a), iOS: empty headline, explanation and one action above other content. | Existing EmptyState/Notice hierarchy; skeleton/offline/error are specified extensions, not pictured states. |
| R02 | [Asana list/detail pane](https://mobbin.com/screens/4b448c3a-ea3c-441c-8af6-abde7ad992dd), web: status sections, selected row, right-side detail/activity. | Grouped list and docked panel; phone uses the same content in a sheet. Counts/bulk controls are specified native additions. |
| R03 | [Linear issue detail](https://mobbin.com/screens/4d807c4c-b0a5-4e87-86bd-154fb51d3f32), iOS: identifier/title, metadata chips, readable sections and bottom action area. | DetailSheet content, wrapping action metadata and sticky actions without copying issue-specific fields. |
| R04 | [Airbnb time slots](https://mobbin.com/screens/cc30131f-ba65-4613-b8e2-304eba91f5b1), web: date strip, selected time chips and fixed next-action foot. | Single controlled slot selection; native scrolling sheet and usable chip targets. |
| R05 | [Klook date/quantity](https://mobbin.com/screens/75c64351-7fef-4198-ac3d-72ec0b2432a4), web: disabled days, time choices, quantity +/- and sold-out option. | Supplied capacity and quantity bounds, with text reasons; no implied capacity transaction. |
| R06 | [Fresha week calendar](https://mobbin.com/screens/14d65e9e-4469-46a0-a483-8e95091c397b), web: week controls, timed blocks, status marks and overlap. | Scrollable native week timetable and agenda alternative; no staff-specific rules. |
| R07 | [Equinox day schedule](https://mobbin.com/screens/f469c43a-f58d-4bb4-aa10-7b3cbe284e6c), iOS: separate today/selected markers, day heading, time-labelled row. | DayStrip/AgendaList, including empty dates and text status. |
| R08 | [ElevenLabs step rail](https://mobbin.com/screens/142853bc-e171-4128-8386-6e288b5ad49d), web: completed/current/pending steps, current form, back/continue and save-exit. | Compact phone progress with reviewable steps and a distinct save-exit outcome. |
| R09 | [Uber Eats item sheet](https://mobbin.com/screens/6243dd29-0d9d-4810-a7c2-eed1bc9b7736), iOS: priced product tiles and bottom action carrying quantity/total. | ProductCard, Price and BuyBar; full cart/receipt composition extends that purchase hierarchy. |
| R10 | [Yami options](https://mobbin.com/screens/5e7aabb9-eef8-4a90-bacc-eb15c521a417), iOS: wrapped variant chips, selected outline, crossed-out unavailable choices and quantity control. | One core choice model with disabled reasons and accessible selection. |
| R11 | [Dribbble plans](https://mobbin.com/screens/73f76d09-9508-49ba-810e-8b2d13ff74e6), web: billing toggle, tier prices, highlighted plan and feature lists. | Vertical native tiers and labelled feature comparison; no copied prices or inferred savings. |
| R12 | [Savee masonry board](https://mobbin.com/screens/ae31b243-afc4-4f4c-925f-88d342dc3701), web: varied image aspect ratios and narrow gutters. | Image-led wall/gallery with controlled viewer; screenshot does not show a viewer gesture. |
| R13 | [Fi profile](https://mobbin.com/screens/3f271e88-4cc1-4c53-8172-602069a0fe78), iOS: full-width photo, title below, grouped details and success notice. | MediaHero and confirmation; PhotoViewer is an explicit extension of image focus, not an observed screen. |
| R14 | [Felt operations map](https://mobbin.com/screens/69edfc38-9b7d-4d32-8319-87ebd3cb3829), web: status points, legend/list panel and attribution. | Native map/list parity, shared selection and status symbols. No routing/monitoring capability implied. |
| R15 | [Freenow trip sheet](https://mobbin.com/screens/b1ac38f3-23c1-470f-aac9-ccb002514a1e), iOS: map above selected-item sheet, headline, grouped facts and actions. | Shared map selection/detail surface. A static handle does not prove drag behavior. |
| R16 | [Perplexity analysis](https://mobbin.com/screens/1869bca8-2987-4a83-9969-b41054034520), web: numeric summary, comparison markers and data table. | Stat/value hierarchy only. This image is **not** evidence of an area or bar chart. |
| R17 | [Vanta event log](https://mobbin.com/screens/41659ab7-5710-4abf-91ca-c6bf482c9b0b), web: actor, exact time, action, target and details. | Activity rows with supplied details. Blurred source content is not a fixture or a schema. |
| R18 | [PlanetScale audit log](https://mobbin.com/screens/cffaf650-8adc-4a34-9b7e-c1c0e6e43a75), web: human action, event code and timestamp per row. | Typed audit presentation; before/after is a specified extension, not inferred from this screenshot. |
| R19 | [Savee phone feed](https://mobbin.com/screens/b54c849c-0350-47b5-a3d7-423073d0b092), iOS: two-column images and floating navigation above the safe area. | MasonryWall native framing; shared shell retains navigation ownership. |
| R20 | [Yahoo Finance lists](https://mobbin.com/screens/410b73e3-e5de-4807-ad8d-b2bff88251e1), iOS: row sparkline, exact value, signed change and list aggregate. | Sparkline and StatTile, with textual trend and data access. |
| R21 | [Uniswap tokens](https://mobbin.com/screens/e39f0d0f-bed1-49ff-92e0-c53d36d34de6), web: compact sparkline column and signed changes alongside values. | Small repeated trend views; never repeat the table's financial domain facts in shared code. |
| R22 | [Airwallex line items](https://mobbin.com/screens/8b2befc5-22f7-4fa0-81a8-1a8f6c7ddad6), iOS: currency-labelled amounts, item actions and sticky total summary. | Cart/OrderSummary alignment and exact currency display. It is not a checkout receipt. |
| R23 | [Relevance saved views](https://mobbin.com/screens/c9df4ae4-6265-48ac-8e16-95220d542fce), web: view tabs/counts, filter state, save-view action and confirmation. | Controlled native view/filter chips and save outcome; persistence stays outside UI. |
| R24 | [Sweatpals overview](https://mobbin.com/screens/50fbe150-69d2-422f-8a9c-c2ce539afc4f), web: range/comparison controls, KPI values, axis frame and one plotted sample. | Chart frame/range/StatTile hierarchy. Area and bar forms are specified adaptations; no supplied inspected image establishes their filled/bar geometry. |

## Conformance cases written before implementation

These are normative, independently chosen Given/When/Then cases, not claims of
executed tests. Port them into the existing test owners with the slice they
cover. No executable test/fake implementation is added in this specify-only
phase. A test of a proposed helper currently fails because the export/behavior
does not exist; a test of an existing delegated behavior must continue to pass.
Do not leave an intentionally failing placeholder suite on the default branch.

There is **no SQL service or SQL conformance fake in this repository**. The brief's
SQL/fake shared-decision rule applies here as one core decision used by both real
UI and test renderings. Reuse `tests/fakes/shell.ts` (`fakeApi`, `shellValue`) and
`tests/fakes/router.ts`; they return supplied responses and record calls, without
reimplementing eligibility, totals or transitions. FakeApi is not evidence of
RLS, grant rechecks, transaction rollback or outbox atomicity. A future backend
capability must test those against its actual shared domain decision and SQL.

| Case / owner | Given → when → exact expected result and failure reason |
| --- | --- |
| C01 / core copy + theme UI | Two mounted callers, `en-GB/UTC` and `pt-PT/Europe/Lisbon`, same explicit instant and different palettes → update only the first presentation → the second retains its language/zone/palette. Current global/default formatter paths cannot satisfy the explicit contract. |
| C02 / core/atoms | Error Issue is immutable → caller supplies an action with intent retry-read → invalid-input (immutable), no retry model/callback. Correctable read error + retry-read → one read intent; success never emitted by the state atom. |
| C03 / atoms | Action busy or disabled → touch, keyboard and accessibility activation → zero callbacks. Busy keeps the same label. Empty result → EmptyState; failed first read → Notice, never the empty result. |
| C04 / data/core | Sections contain row IDs `r9,r2` and `r6`, eligible `r9,r6`; selection input `r6,r9,r6` → select loaded → `r9,r6`, count 2, no server-all flag. A duplicate row ID in different sections instead refuses invalid-input (immutable). |
| C05 / data/UI | Select `r9`; activate its checkbox and then its inline action → checkbox changes selection once without onOpen; action calls only `onRowAction('r9',actionId)`. Default row-body activation calls only onOpen. |
| C06 / screen + FakeApi | First query has selected IDs; change sort/filter/view while its read is pending, then resolve old read last → old rows/selection never reappear. Reuse generation semantics; do not create another request runner in the fake. |
| C07 / data/core | 2 loaded rows, section total 8 → heading states supplied total and loaded scope; absent total → no invented 2-of-2 assertion. Total 1 with 2 loaded → invalid-input (immutable). |
| C08 / screen + FakeApi | Save current view request rejects → dirty view remains and no success label. Successful supplied response installs returned ID; switching view clears selection. No hidden storage call in DataList. |
| C09 / detail/UI + router fake | Dirty sheet → system back/Close → one confirmation intent, open remains true. Busy-blocked → no close. Confirm accepted → caller closes and restores focus; native swipe disabled before a dirty sheet can dismiss. |
| C10 / activity/core | Two events at the same instant with IDs `b` and `a` → display `a,b`; missing before, empty-string after and redacted before remain three distinguishable values. Unknown payload yields no fabricated changes. |
| C11 / activity/UI | Explicit now 20 minutes after event → localized relative text; exact timestamp remains accessible. Omit actor → unknown/system per explicit kind, never guessed from an empty name. Excluded history offers no network retry. |
| C12 / step/core + UI | Three steps: first complete, second current/incomplete, third incomplete → progress 1/3. Next with supplied field problem stays on second; valid result moves third; back then edit first invalidates first and subsequent completions while preserving caller values. |
| C13 / step/core | Required step skip → validation (correctable), no advance; optional step skip → skipped, progress increments, skipped count announced. One-step flow requests Finish once; zero steps offers no Finish. |
| C14 / step/screen + FakeApi | Save-and-exit starts then rejects → no router.back and same draft/step. Timeout after dispatch → write-unknown (correctable by persisted read), zero automatic resubmissions; a later confirmed persisted draft allows exit. |
| C15 / slot/core | Now `2026-12-08T08:00:00Z`; open slot `09:00–09:30Z`, capacity total 4/remaining 2, quantity 2, validUntil `08:15Z` → eligible. Quantity 3 → unavailable (correctable); no onSelect. Remaining 5 → invalid-input (immutable). |
| C16 / slot/core | Same slot at now equal to start or now equal to validUntil → unavailable (correctable). Capacity total 0/remaining 0 → valid full state. Unknown capacity → visible unknown, no selectable assumption. Booked → read-only (immutable for that surface). |
| C17 / slot/screen + FakeApi | Select snapshot `av7`, then refresh `av8` with remaining 0 → invalid selection displayed, confirm disabled, no render-time callback. Simulated server conflict after `av7` submission clears pending, reloads, emits no success. This does not test two real bookings racing in SQL. |
| C18 / calendar/core | Europe/Lisbon day `2026-03-29` → UTC `[2026-03-29T00:00:00Z,2026-03-29T23:00:00Z)`, 23 hours. Day `2026-10-25` → `[2026-10-24T23:00:00Z,2026-10-26T00:00:00Z)`, 25 hours. PlainDate addition produces the following civil day. |
| C19 / slot/calendar/core | `2026-10-25T00:30:00Z` and `2026-10-25T01:30:00Z` in Europe/Lisbon → both read 01:30 with offsets `+01:00` and `+00:00`, distinct IDs and callbacks. No nonexistent local 01:30 spring slot is synthesized. |
| C20 / calendar/core | Event ends exactly at next midnight → only previous day segment. `[09:00,10:00)` and `[10:00,11:00)` share a lane; a third `[09:30,10:30)` requires a second lane. Tie order is start/end/ID. |
| C21 / calendar/UI | Two overlapping short events cannot each have the minimum target → one labelled group control opens both ordered event IDs. Agenda exposes both; no inaccessible overlapping hit areas. |
| C22 / money/core | EUR exponent 2: `257 * 3 + 1099 * 2 = 2969`; adjustments `-270,+85` → total `2784`. Quote 2784 agrees; 2785 refuses invalid-input (immutable), with no checkout model. Values are independent of locale. |
| C23 / money/core | `9007199254740993 + 1` minor units → `9007199254740994` exactly. `9223372036854775807 + 1` → invalid-input (immutable overflow). `-0`, `01`, `1e3`, decimal minor strings → invalid-input (immutable). |
| C24 / money/core | Same currency code but exponents 2 and 3, or EUR with USD → invalid-input (immutable); no combined total. Two cancelling adjustments beyond intermediate int64 but within their individual input range do not make result depend on array order. |
| C25 / price/core | EUR 2784 at en-GB vs pt-PT → fraction `84`, currency `EUR`, locale decimal separator and grouping preserved. Zero- and three-decimal Currency examples render exactly 0 and 3 fractional digits. No amount-to-Number conversion. |
| C26 / quantity/core + UI | min 2/max 10/step 2, value 6 → +/- emit 4/8. At 2 no decrease; value 7 gives validation (correctable), never auto-rounds to 8. Removing the only cart line emits remove and permits empty after confirmed caller props. |
| C27 / cart/screen + FakeApi | Quote expires or a quantity/option changes → checkout unavailable (correctable), old quote removed. Two immediate activations while busy result in one fake request; timeout does not trigger another request. Server price/grant correctness is outside this fake. |
| C28 / pricing/core | Plans `p1,p2`, selected period `annual`, p2 has only `monthly` → p2 unavailable for annual, no price multiplication. Missing feature is unknown, explicit excluded stays excluded. Selecting a plan emits intent but does not change currentPlanId. |
| C29 / map/core + UI | Two points at `(0,0)` with different IDs → both present, disambiguation opens their ordered list. NaN latitude → invalid-input (immutable), never substitute zero. Empty set keeps supplied viewport. |
| C30 / map/screen + FakeApi | Select point in list then toggle map → same sheet/ID; provider fails → list stays usable with provider error. Switch session while provider callback is pending → old points/selection/callback never surface in new session. This is client-scope evidence, not RLS proof. |
| C31 / media/core + UI | Items portrait 600×900 and landscape 1200×800 → preserve aspect ratios and source-order traversal; a recycled cell loading the latter shows its own skeleton, never the first image. Zero width → invalid-input (immutable). |
| C32 / media/UI + provider adapter | Open second ID, zoom, move next, close → zoom resets for new ID and focus returns to original thumbnail/fallback. Remove selected ID while open → unavailable/Close, no silent reassignment. All actions have keyboard/reader equivalents. |
| C33 / chart/core | Points `(0,-2),(1,4)` → line y domain `[-2,4]`, normalized y positions 1 and 0; area/bar include zero. Constant 5 → `[4,6]`; single x 7 → `[6,8]`. One point is a dot. |
| C34 / chart/core | y sequence `2,null,3` → two disconnected segments/dots, no bridge or interpolated 0. All null → empty. Duplicate x, unsorted x, NaN or explicit domain hiding a sample → invalid-input (immutable). |
| C35 / chart/UI | Keyboard-selected data row and touch-selected sample → same ID/value label; range change emits chosen opaque range ID once, stays busy until new props, does not invent a duration/query. |
| C36 / stat/core | Current 90, previous 120 → absolute -30 and -25.0%; lower-is-better is favourable, higher-is-better unfavourable. Previous 0 → no-baseline label, no Infinity (including current 0). |
| C37 / all new controls | Common matrix in both modes/EN/PT and supplied themes → real focus/pressed/disabled/busy behavior, long text, visible status symbols and reduced motion. A snapshot alone cannot pass keyboard/reader/gesture assertions. |
| C38 / package/layers | Import each new component from its actual UI subpath and each factory from core/derive in the existing packed-source check → complete dependencies, no React/effects in core or shell/router/transport in UI. Forbidden-import probes continue to fail for the expected boundary. |

The fake-screen cases assert both what becomes visible and which calls **did not
occur**. A refused local intent causes no API call; a refused server mutation
cannot be asserted to have rolled back solely because the fake rejected a
Promise. No tests may relax the existing catalog/source/layer/provenance guards.

## Ten capability questions and Limits

| Question | This library's resolved share; product/server limit |
| --- | --- |
| 1. Entity fields | The readonly input types above are presentation values, not new stored entities. Unknown HTTP responses are validated in core before deriving them. No manifest fields, tables, SQL models or ignored metadata are added. Product fields/labels are supplied explicitly. |
| 2. Identity and relationships | Stable IDs identify rows, groups, steps, slots, events, products, cart lines, plans/features, map points and media. References must resolve within the supplied scope; IDs never grant access. Products own tenant/entity relationships and server-issued revisions. |
| 3. States and transitions | Common Content/Action/refusal states and the per-group transitions above are exhaustive for these UI surfaces. UI emits intent, caller supplies outcome. Domain lifecycles, recurrence, entitlements and booking/order completion are not inferred from display labels. |
| 4. Authorization | No new grant or tenant filter is defined. Caller supplies only authorized content and action eligibility. Every write remains subject to the server's actor grants, explicit tenant transaction and RLS; hiding a control is not enforcement. Forbidden/not-found clears stale content (immutable for that actor/record). |
| 5. Transaction/concurrency | No client transaction or lock exists. Reuse generation guards; discard old-scope completions; busy prevents duplicate UI activation. Capacity, revision, last-required-member and price checks remain inside the authoritative `db.Tx[db.Tenant]` command transaction. Do not claim the current generic CRUD endpoint has expected-revision support merely because a new UI needs it. |
| 6. Events/idempotency | Callbacks are local intents, not events/audit facts. The UI emits no outbox message or audit record. Caller must use the capability's documented idempotency/reconciliation mechanism; one key per intended durable write only where that contract exists. Mutation and audit/outbox atomicity remain server responsibilities. |
| 7. Retention/export | No durable storage, offline mutation queue, draft store, saved-view service or export endpoint is introduced. Screen state is released on scope change. Product owns retention, audit disclosure/export, saved-view sharing and authorized media lifetime. A local UI screenshot is not a data export contract. |
| 8. Providers | Explicit map/image/zoom adapters and selected OSS are above; requests/configuration stay in effects/screen composition. Product chooses tile provider, media source, payment/booking/calendar backend, licensing and data policy. No global tenant provider, credential, self-discovery or registry. |
| 9. Locale/time/money | Presentation is explicit per caller; EN/PT copy, Intl locale/zone, UTC instants, Gregorian dates and exact int64 Money/Currency are specified above. Product supplies currency/exponent, business zone, billing period labels, quote validity and specialist rounding before amounts reach UI. |
| 10. Specialist validation | Core checks structure, availability display, quantity bounds, arithmetic and geometry. It does not encode sector/jurisdiction facts, contractual scope, clinical/legal suitability, inventory policy, tax rates or prices. Product/capability supplies field problems and authoritative decisions. |

Go `contracts/` imports, service constructors, tier imports, transactional
migrations/RLS policies, SQL fakes and module registry entries are not deliverables
of this independent TypeScript library. No fake Go module is added to make the
generic phase commands green. If a future backend capability is needed, it gets
its own brief with the specified kernel imports, transactional tenant-first
`.up.sql` migrations and SQL conformance cases; this phase changes no registry.

Open **product** decisions are therefore: which authorized records/actions to
compose; product field/noun/alt-text copy; complete supplied theme/fonts; business
timezone and week start; availability freshness/capacity source and reservation
rules; draft/saved-view storage and sharing; quote/tax/shipping/currency rules and
checkout idempotency; plan contents/entitlements; tile/media providers, rights,
credential/cache policy and retention/export. None may be answered by branching
on a product name inside these shared components. Defaults already specified
here (selection scope, date arithmetic, ID behavior, error recovery, chart
geometry, native layout ownership) are not deferred to products.

## Pillar evidence and implementation handoff

| Pillar | Path and required evidence / applicability |
| --- | --- |
| Tenant-first | `src/effects/api.ts`, `src/shell.tsx`, existing screen generation guards; C30/C01 ensure old client state does not reach another scope. Database tenant enforcement remains the server transaction/RLS boundary; this spec neither changes it nor supplies a two-tenant SQL test. Do not report those client cases as database isolation. |
| One process, many tenants | `src/ui/theme.tsx`, explicit Presentation and provider inputs; C01/C30 cover independently mounted callers and stale completions. Remove changed helpers' global device-format cache; no per-process client choice is introduced. |
| Auditable | `src/core/activity.ts`, Activity and `useActivity` display supplied audit facts. No durable state change in this spec or UI-only helpers, so an audit-write/read-back record is not applicable here. Product commands still owe their own audit/outbox transaction test. |
| Traceable | This document introduces no request/job/emitted event. Screen effects reuse Api; provider loading is an explicitly owned native effect. No live trace propagation is claimed. Products must prove command/request correlation at the server boundary they use. |
| Standard-first | The dependency table names native primitives, Intl/Temporal, bigint, MapLibre, FlashList, Zoom Toolkit and D3/SVG, with reasons for composition over a second suite or viewer. Pin/build/device validation is owed by implementation. |
| Core stays core | `src/core/derive.ts` owns decisions and public types, UI layer subpaths own generic presentation, renderer pack is the extension point. C38 and `npm run check` must preserve import direction and packaged consumption. |
| Web and mobile | Built here as native components for Android/iOS. Web reference images guide hierarchy; Expo web preview is not native transport/device evidence. This adds no Go web component or promise of identical web/native renderer internals. |
| Measurably better | The program's current `tools/pillars.py` mobile indicator counts calls to a retiring discovery alias. It is already 0 at the inspected merge base; each implementation report repeats that scan at its head. The indicator does not measure richer components. Implementation reports completed component/state/theme/locale tuples and verified native journeys, with numerator/denominator and paths, rather than claiming a subjective score improved. |

For each slice, IMPLEMENT.md must list Reused / Added / Made reusable, the changed
public props and migrated consumer, each case/state/theme evidence path, exact
commands/output and what was not verified. The phase gate is the brief's
`{ test -d node_modules || npm ci --no-audit --no-fund; } && npm run check`.
Before a commit, run `npm run check`; for runtime journeys run the affected
Maestro flows with `make e2e-android` and name the actual flow files/results.
Use the existing sign-in flow where authenticated records are needed. Gallery
alone does not prove server behavior. Also run the corresponding iOS journey
and keyboard/VoiceOver/TalkBack checks before claiming both native platforms.

Fingerprint/source/catalog fixtures change only when their real inputs change,
through the existing scripts. A new native module needs a new binary and a
commit explanation. Do not copy screenshot pixels, product palettes or native
build outputs into this specification delivery. No implementation evidence,
device pass, all-product theme pass or post-implementation metric is claimed by
the specify phase.
