# People and row pictures

Status: implemented contract. The conformance cases below were specified before
code; delivery evidence and native verification limits belong in the README.

The mobile kit draws people with a portrait or initials, declared groups as
an overlapping stack, and resource rows with a picture or an icon tile. The
catalogue chooses what is a person and which picture a row uses. Screens resolve
authorized inputs; core derives the presentation; molecules draw it.

## Evidence and ownership

The traced mobile baseline is `c4d90a1be43133b10781e8ee0629f0b1de419f23`.
Its HTTP fixtures pin public kernel commit
`5c196c06e6846647aefcb25fd66081c6843d838e`. The implementation repins
the API and catalogue to the picture-hints merge,
`42d4b8e8c21d4b7a512d2437c20ee5c729dbecc0`, and regenerates with `npm run api`.
Both source receipts carry SHA-256 values from that exact public commit;
generated files are produced by the generator. The catalogue version remains 2.

The existing consumers are ResourceList → DataList → Row, ResourceDetail →
Value, Home's account/resource rows, and Activity's actor line. At the baseline, reference hooks
kept names only. Identity validation discarded the already-declared
`displayName`. RichTextBody → fileResource → NativeImage already supplies a
bearer header to the installed image loader, with obsolete-completion guards
and no caching. The baseline parser dropped `pictures`, `coverField` and
`thumbnailField`. Those are the owners to extend.

The public server contract is owned by `kit/entity`, `ui/screens`, and the
existing file, user, task and content modules. See the pinned source and the
[architecture](https://github.com/septagon-oss/platformkit/blob/42d4b8e8c21d4b7a512d2437c20ee5c729dbecc0/ARCHITECTURE.md)
and [contribution guide](https://github.com/septagon-oss/platformkit/blob/42d4b8e8c21d4b7a512d2437c20ee5c729dbecc0/CONTRIBUTING.md).
This is a native client change, with no new server module, SQL service,
`contracts/` directory, migration, registry or composition path.

| Deliverable | Reuse decision from the trace inventory |
| --- | --- |
| API/catalogue refresh | **Composed from** the pinned fixtures, source receipts and `scripts/api.ts` workflow. |
| Picture metadata and media selection | **Composed from** `src/core/catalog.ts`, `derive.ts`, `catalogList.ts`, `collections.ts` and the existing visibility rules. |
| Person projection | **Composed from** `Names`, `nameKey`, `referencedName`, reference hooks, activity directory reads and shell identity; enrich their existing resolved result rather than add another directory. |
| Stable person tone | **New, because** the inventory found no mobile hash and the web avatar has no hash; a pure helper exported through `src/core/derive.ts`. |
| Avatar | **New, because** the inventory found no native avatar; compose existing Text/Icon, theme, scale and ImageRenderer. Preserve the web avatar's initials and name-once semantics. |
| AvatarStack | **New, because** the inventory found no native stack; compose Avatar with one core-derived remainder and label. |
| RowMedia | **New, because** MediaHero's caption, notices and full-image frame do not fit a compact row; compose its existing ImageRenderer contract, Icon, theme and scale. |
| Leading row/Home media | **Composed from** Row with a leading slot, existing DataList and Home derivation/composition; no parallel list or account shell. |
| Authorized image path/cache policy | **Composed from** effects/files.ts, ImageResource, NativeImage and RichTextBody's request lifecycle; replace address guessing with the declared picture door. |
| Gallery and conformance examples | **Composed from** `src/ui/gallery.tsx`, existing molecule/core/screen suites, `tests/fakes/image.ts`, `tests/fakes/wire.ts` and existing deferred-response patterns. No new service or image-loader fake. |

## Catalogue and value contract

Retain normalized `pictures?: { source: string; widths?: readonly number[] }`
and entry `hints.coverField?` / `hints.thumbnailField?`. Absence remains valid.
The compatibility parser treats a defective optional picture declaration like a
defective presentation hint: emit a developer path/reason diagnostic and draw
the fallback; do not remove the resource. The strict generated operation
validator retains the upstream wire contract. No supported catalogue-version
or general response-validation rule changes.

`source` must be a root-relative path under `/api/v1/`, with exactly one literal
`{id}` as an entire path segment. Accept ordinary path segments containing ASCII
letters, digits, `_`, `-` and `.`; reject dot-only segments, percent escapes,
whitespace, control characters, backslashes, queries, fragments, authorities,
other braces and other placeholders. Only the canonical lower-case hyphenated
UUID value is substituted. An invalid source disables the picture door
(immutable for that catalogue). It never causes an anonymous request, an
external-origin request or a constructed file route. This is the supported
native template subset; future templates outside it use the fallback.

Widths are positive safe integers in strictly ascending order without
duplicates. Missing/null/empty widths mean the original. A defective width set
is dropped as a whole (immutable for that catalogue); a valid source survives
and requests the original. Never send a width inferred from a remembered
server release. Add `?w=<width>` only for a validated declared width.

A thumbnail pointer must name a field of this entry with `present: image`,
scalar UUID/string shape admitted by the server, and row visibility permitted
by the existing `rowContent`/`hideList` rule. A cover pointer must name a visible
`present: image` field; it becomes a thumbnail only if also permitted on a row.
An invalid explicit thumbnail pointer is discarded, then the cover default is
considered. A valid explicit thumbnail whose row value is empty or invalid does
not switch to the cover: the thumbnail choice is a field choice, not a search
through record values. Values are file-row IDs, never remote URLs.

Person inputs come from declared `present: person` values, declared references
to the existing `user/user` directory, activity's explicit person actors, and
the authenticated account. Do not infer a relationship from names such as
`authorId`, `assigneeId`, `avatar`, `image` or `thumbnail`. A textual
`present: person` is already a name: it causes no directory lookup and has no
stable person ID, so it gets neutral initials. Non-person references keep their
existing presentation. Do not change reference pickers or writes.

For a resolved person row, the existing name rule supplies the visible name.
Its portrait is the first visible scalar field, in schema order, explicitly
declared `present: avatar` and holding a canonical file ID. Ignore invalid or
empty candidates. There is no field-name guess. Hidden fields never contribute;
list enrichment excludes fields kept off lists, while a detail read can use a
detail-visible portrait. A missing picture door leaves initials.

Enrich the existing name-directory result with a people projection keyed by
`nameKey(resource, id)`, carrying only identity, resolved display name and
optional portrait ID. Keep the names projection for ordinary references and
existing callers. Both projections come from the same responses and share
invalidation, rather than storing full person rows or issuing parallel reads.
Record screens retain one read per distinct reference; lists retain one page
of at most 200 records per declared target. An unresolved ID outside that page
stays unresolved; do not page through the directory to fill a face.

Preserve `displayName` in the existing identity response projection. The account
shows that name when nonblank, otherwise its authenticated email, with email
still available in the existing chooser. Neither pinned identity nor the user
resource currently declares a portrait. Do not add a wire property. When a
future catalogue declares a user portrait, Home may read its own user record
once through its screen hook to resolve it, only when the mounted user entry
supports read. Without that declaration, account initials need no extra read.

Activity keeps `system` and `unknown` as distinct non-person cases. An identified
actor gets a person model even if directory enrichment fails; its visible name
is the existing localized unavailable-name label, with a person glyph rather
than initials made from that label. For the signed-in actor, visible `You` /
`Você` is a copy-table label; initials use the actual authorized name or email,
never the translated word. A directory refusal withdraws both names and faces,
while an authorized event can retain the fact that its actor was a person.

## Pure models and component contracts

Core exposes the following contracts through `src/core/derive.ts`; helpers may
live in another pure core file. Models contain no URL, token, header, native
image handle, callback or theme colour. The screen passes an ImageRenderer
separately, using the existing ImageSlotProps. All fallback choice, initial
extraction, group counts, labels and tone selection happen in core.

| Contract | Inputs and output |
| --- | --- |
| Person input | Optional stable ID, authorized actual name, visible label, optional declared portrait file ID. Unavailable names are explicit, not text mistaken for a real name. |
| Avatar model | Visible/spoken name, initials or person-glyph fallback, safe tone, and optional image with `loading`/`ready`/`error` state and a slot with `fit: cover`, square aspect ratio and decorative semantics. Avatar takes the model, `renderImage?`, size (`small` or default `regular`) and optional testID. It renders a disc plus the visible name; the stack uses the same disc with the name supplied by the stack. |
| AvatarStack model | First three distinct people in input order, optional `+N` remainder, one visible group description and one spoken description. Stack takes the derived model, image renderer and optional testID. It owns no lookup or selection rule. |
| RowMedia model | `none`, icon tile, or picture slot plus optional icon-tile fallback; picture state is `loading`, `ready` or `error`. RowMedia takes this model, optional image renderer and testID. It has no press or retry action. |
| Row leading slot | Optional decorative React element before Row's text column. Row still owns the single press target, title, cells, status and existing accessible label. |

Initials: trim Unicode whitespace, split on Unicode whitespace, take the first
Unicode code point of the first and last words (only first for a single word),
then apply locale-independent uppercase. Do not split surrogate pairs. Preserve
punctuation within words; do not infer family names or transliterate. Thus
` Ana María Silva ` → `AS`, `李` → `李`, and `Éva Stone` → `ÉS`.
An absent actual name yields a person glyph, never the initials of a fallback
sentence or an ID. An authenticated email used as the actual account label
counts as one word. No external initials package is needed.

The tone helper accepts a nonempty ID exactly as supplied, with no locale,
normalization, random seed, date or process state. Starting at unsigned
2166136261, for each UTF-16 code unit in order, XOR that unit into the hash,
multiply by 16777619 with unsigned 32-bit wraparound, then take unsigned result
modulo 4. The fixed tone order is `[info, ok, warning, neutral]`. Empty or
whitespace-only IDs return neutral without hashing. This is a visual bucket,
not a security hash or a status claim. `danger` can never be returned.

Independent expected vectors (calculated with integer arithmetic, not by the
future helper): `a` → 3826002220 → info; `b` → 3876335077 → ok;
`c` → 3859557458 → warning; `d` → 3775669363 → neutral;
`person-17` → 3388185023 → neutral; `Åsa` → 1430688184 → info.
Changing name, locale, theme or list order cannot change the bucket for an ID.

Theme maps tones to the existing status foreground/background pairs and neutral
to `textPrimary` / `surfaceMuted`. Add these usages to the theme contrast-pair
inventory; use generated tokens only. A fallback disc has its assigned tone
while a portrait loads and after it fails. Colour conveys no permission or
state. Resource icon tiles use the info pair consistently; the brief declares
no resource colour field, so do not invent one.

Stacks are for explicitly supplied groups, including list-valued declared person
references. Read list values through the existing core list-value helper;
discard wholly empty entries. Treat blank IDs as absent; deduplicate ID-bearing
people by resource plus ID, keeping the first occurrence. Named, ID-less textual
entries retain their input positions. Never combine unrelated fields to manufacture a group. An
empty group draws nothing; one draws the single person; two or three show all
discs; more show three discs then `+<total - 3>`. The description for total > 1
is the first visible name and `total - 1` others, so five people show three
discs, `+2`, and “Ana and 4 others”. These are deliberately different counts.
Input/source order is also accessibility order; later discs paint above earlier
ones. Groups do not open a new picker or viewer.

Use `src/ui/scale.ts` for dimensions: named avatar small/regular extents 24/32,
row-media extent 40, and overlap 8 density-independent points. Reuse `radius.full`
for discs, `radius.md` for square media, `space.sm` for name gaps, and
`extent.focus` with surface ink for the separator around overlapping discs.
Only scale.ts contains those new lengths. Text containers may grow with Dynamic
Type; do not clip the name to the disc height or shrink its font. The existing
Row hit minimum stays unchanged; a face is decorative, not a new small control.

Avatar names are visible beside discs on person surfaces. The account control
keeps `account` as its existing press target. Inside an already-labelled Row,
Value or Activity item, suppress disc/initial/image announcements and let the
existing parent speak the name once. A standalone labelled Avatar speaks its
visible name once. A stack speaks its derived group description once; neither
`+N` nor hidden overlapping discs add redundant announcements. Resource pictures
are decorative because the row title already identifies the record. No image
load/failure announcement interrupts list traversal. No animation is required:
image transition duration remains zero for both motion preferences. This also
prevents an animated effect from being the only readable state.

Add `kit` copy entries in `src/core/copy.ts` for group descriptions (singular and
plural others), the remainder and `You`, in both languages. Required examples:
`Ana and 1 other` / `Ana e mais 1 pessoa`, `Ana and 4 others` /
`Ana e mais 4 pessoas`, `+2` / `+2`, `You` / `Você`. Format counts using the
existing presentation locale. Reuse existing account, System and unavailable
name words. New English literals do not belong in screens or organisms.

List media precedence is the validated thumbnail field, otherwise the validated
cover default, otherwise no picture. With a usable picture ID and source, show
a rounded square and canvas-colour loading state, then the picture. On byte
failure use the declared entry icon tile; with no entry icon, draw no slot.
With no picture initially, use the declared icon tile or no slot. An unknown
icon declaration is ignored (immutable for that catalogue), so a list does not
invent one. Home always draws a resource tile, using its declared icon or the
existing generic `grid` glyph. Extend the existing Icon adapter to map all 16
kernel resource icon names; do not add an icon package or registry. There is no
blurhash on the pinned wire; choose the brief's canvas-colour option and do not
compute a hash by fetching an image just for its placeholder.

## Image loading and lifetime

1. The existing owning screen hook collects distinct picture IDs selected by
   core from the rows/people it actually displays. It supplies a render closure
   to the props-only tree; that closure binds ImageSlotProps to effects-owned
   ImageResources. No molecule reads the shell or performs HTTP.
2. Extend `fileResource` to consume the validated catalogue source rather than
   construct `entry.path + /content` for catalogue pictures. Keep the existing
   rich-text content-address fallback only for older catalogues with no picture
   door; rich text already declares a file resource independently. New compact
   images require the door. If a door is present, RichTextBody uses it too.
   Retain one address/template helper in effects, not a second image transport.
3. Preparing a compact ImageResource requires the selected server, the current
   authenticated user and current bearer. No bearer means no native image
   request. Substitute the file ID into the validated relative source and put
   `Authorization: Bearer …` in the native loader header only. No session cookie,
   query token, external fallback URL or URL log is introduced. Native requests
   use the selected origin; redirect authorization behavior must be verified on
   device before claiming protection across redirects.
4. Where the catalogue mounts the existing file metadata read, reuse that read
   once per distinct ID in the screen load to obtain dimensions, content hash
   and visibility. Do not read full file listings. A metadata 403/404 stops that
   image for the visit. A missing metadata resource is not permission to guess
   it: the declared source may be loaded with original-size/uncached defaults.
   A transient metadata failure retains a displayed resource in the same session;
   on a first read it may use that uncached declared source. It never revives a
   refused resource or earns public caching. Cached/offline metadata cannot earn caching
   either. A native byte request remains independently authorized by the server.
5. Generalize the existing pure width planner to accept the catalogue widths.
   For positive measured physical slot pixels, choose the smallest declared
   width >= the slot, or the largest declared width when all are smaller. If
   measured original width is <= the slot, request the original (0). Unknown or
   invalid slot width, or no declared widths, also returns 0. With unknown frame
   width a valid declared variant may still be requested; the server returns
   the original if it did not plan that variant. Migrate the existing prose
   consumer to this planner rather than keep two decisions. Its older-catalogue
   path may request the original; remove the remembered fixed width set.
6. The native adapter uses the installed `expo-image`, `contentFit: cover` for
   compact images, zero transition and explicit `recyclingKey`. For genuinely
   cacheable public media it supplies an explicit source `cacheKey`, never the
   URL alone. Scope includes normalized server, user ID, bearer key ID and the
   shell/session generation. Append declared source, file ID, metadata content
   hash/update version and planned width. Keep attempt in the request/recycling
   identity; a retry bypasses a failed attempt. Neither token nor full person
   row enters any identity. Width/version/source changes create a new resource.
7. Cache policy is `memory` only for metadata freshly authorized in this load
   with `visibility: public` and a nonempty content version; it is `none` for
   private, unknown, stale-metadata and unversioned media. No disk cache,
   prefetch or device read-store of bytes. Private responses explicitly say
   `Cache-Control: no-store` at the target commit: overriding that policy to
   satisfy a blanket caching promise is out of scope. The mounted view may
   retain its decoded frame while the same authorized resource remains drawn.
   A remount of private media asks the server again. Do not promote a private
   frame to a public cache on the strength of an offline row.
8. Shell scope loss withdraws the old render resources synchronously: sign-out,
   expiry, server/account change and a replaced catalogue invalidate the owning
   generation before any new paint. Unmount native images, drop resolved people
   and media state and request `Image.clearMemoryCache()` through an effects
   adapter. Clearing is best effort; false/rejection cannot restore an old
   resource or block sign-out. A new session always has a new cache namespace,
   even for the same user/key. No private data relies on cache-clearing success.

Keep the current NativeImage per-request callback guard and add the screen
generation/slot key to the result application guard. State belongs to a slot
and resource, not just a file ID: the same file may appear twice, and the same
row may be recycled for another file. Loading/ready/error callbacks from an old
session, replaced resource, removed slot, prior attempt or unmounted screen do
nothing. A cached completion is still subject to these guards. Cancellation is
best effort; invalidation is authoritative. No callback changes catalogue,
authorization, domain rows, outbox or events.

Compact media has no automatic retry loop or separate retry button. A user
refresh/remount begins a fresh attempt; the existing whole-screen refresh stays
available. A ready private picture is not promised immediate revocation if the
server changes grants without notifying the phone; a new read reauthorizes it.
The native loader's error callback does not supply the API's decoded problem
contract. It causes a fallback, not a guessed global session-expiry verdict.
Metadata requests continue through the existing API/shell expiry boundary.

## Refusals and transitions

Correctable means a later explicit refresh/new attempt can recover. Immutable
means no image-specific retry under the same input/catalogue/session; changed
authorization, catalogue, record or session can supply different input. These
are local presentation decisions; they never rewrite a server refusal.

| Condition | Classification and resulting behavior |
| --- | --- |
| No picture declaration, no group, no portrait value, empty field, no picture door | Valid absence, not a refusal: initials, icon or no slot as specified. |
| Invalid source/widths/field pointer, wrong picture shape, invalid file UUID, unknown icon | **Immutable** for the supplied catalogue/value; ignore only the defective optional feature, diagnose its path, no unsafe request. Width defects retain the original source. |
| Missing bearer/authenticated identity | **Correctable** by sign-in; no request or former-session face. The shell owns the sign-in experience. |
| Directory/file metadata 403 | **Immutable** for this actor/catalogue visit; withdraw enrichment, settle that read, no retry or retained unauthorized name/portrait. Base authorized content remains. |
| Directory/file metadata 404 | **Immutable** for this record/visit; same fallback and no stale enrichment. Refusing enrichment does not refuse the base record. |
| Metadata refusal recognized by the existing API as session expiry | **Correctable** by reauthentication; shell invalidates the session. Never show an old decoded picture through reentry. |
| Directory transport/5xx/timeout | **Correctable** by explicit refresh; retain the previous authorized name/portrait in the same session, otherwise unavailable-name/glyph. No background retries. File metadata retains the displayed resource, or uses the uncached declared door on a first read, as above. |
| Native load/network/decode error (status unavailable) | **Correctable** by explicit refresh/remount; portrait → initials/glyph, thumbnail → declared icon or none. No raw error text or auth guess. |
| Unsupported catalogue version or invalid required response | Existing **immutable** compatibility refusal; existing update-app/response handling remains in charge. No media-specific bypass. |
| Attempt to cache private/unknown/unversioned/stale-authorized bytes | **Immutable** for that resource version/policy; force `none`, never retry with a less restrictive policy. |
| Obsolete completion | Ignored result, not a user refusal; no state write, error notice or retry. |
| Native memory-clear failure | **Correctable** by a later lifecycle clear; keep invalidation and new namespace, no old resource restored and no new user-blocking sign-out failure. |

An eligible image starts loading; the canvas/initials still state is immediately
readable. Invoke the renderer during loading and ready, keeping its native view
mounted but visually/accessibly concealed while loading so it can complete.
An error removes that renderer and leaves the fallback until a new attempt.
If no renderer was supplied, core derives the fallback without a loading image.
A current completion moves loading → ready or loading/ready → error.
A ready image stays during an ordinary same-resource render. Replacement or
explicit refresh starts a new loading attempt with the still state, never the
previous image. Removing the picture removes the image request immediately.
The still state does not claim a missing image is still arriving.

## Ten domain questions

| Question | Mobile kit's resolved share |
| --- | --- |
| Entity fields | Consume existing optional catalogue picture door, cover/thumbnail hints, Field.present and file metadata. Add pure models only; no stored domain field or undocumented identity property. |
| Identity and relationships | Follow declared reference resource plus record ID, explicit activity actor and authenticated identity. Picture values identify file rows. Scope reads/images to the active server and identity generation; never infer tenant from a record. |
| States and transitions | Optional/absent, loading, ready and error have the still states and transition rules above. People may be resolved or unresolved without changing the base screen phase. |
| Authorization | Every metadata/content GET uses the active session; server grants and tenant `db.Tx[db.Tenant]`/RLS remain authoritative. A catalogue hint and a cached row confer no access. No mutation is introduced. |
| Transaction and concurrency | No client transaction or SQL service; no snapshot consistency is promised across person/record/file GETs. Generation guards prevent obsolete publication, not concurrent server edits. Server request transactions are unchanged. |
| Events and idempotency | GET-only enrichment; no domain/outbox events, write replay, revision changes or idempotency keys. Duplicate requested IDs are coalesced per owning screen load; repeated visits are valid new reads. |
| Retention and export | No media export, upload, deletion, file retention/uses change or new persisted person store. Public decoded cache is memory only; private bytes have no cache. Namespace invalidation and best-effort purge govern lifetime. Existing server retention remains untouched. |
| Provider integration | Extend the installed native image adapter and existing session/file helpers. No new SDK, provider, registry or server port. Credential headers stay in effects/screens, outside UI/core models. |
| Locale/time/money | Group and fallback words come from the en/pt copy table and counts from presentation locale. Initials/hash are locale-independent. No new clock, timestamp or money behavior; file version is an opaque server-supplied identity. |
| Specialist validation | Validate optional metadata, canonical file IDs, declared picture field shapes, source-template subset and safe tones. Content-type/size/decode safety, file existence, tenant membership and business meaning remain server responsibilities. |

## Conformance cases specified before code

These are implementation acceptance cases, not tests reported as executed in
the specify phase. Put pure cases into the existing core suites and molecule
cases into `tests/ui/molecules.test.tsx`. Extend `tests/fakes/image.ts` to record
the actual adapter's source, cache policy, recycling identity and callbacks;
it must not choose a tone, picture, fallback, width or authorization result.
Use the existing wire/deferred fetch fixtures for metadata/refusal cases. The
real pure decision functions run in these harnesses. There is no new SQL
service to mirror, so SQL/fake-service conformance is inapplicable; inventing
one would duplicate the server and contradict this task's read-only scope.

| Case and independent input | Expected assertion / reason |
| --- | --- |
| H1: IDs `a`, `b`, `c`, `d`, `Åsa` | Exact vectors above; all four safe buckets are exercised, including unsigned arithmetic and non-ASCII code units. Run the same IDs again under changed name/locale/theme/order; results identical. |
| H2: empty/blank ID; 10,000 distinct numeric-string IDs | Blank → neutral; every nonblank result belongs to the closed safe set and never danger. This tests the allowed range, not a promise of unique colours. |
| A1: Ana María Silva, Éva Stone, 李; missing actual name with localized unavailable label | `AS`, `ÉS`, `李`, then glyph. No unavailable-label initials, IDs or broken surrogate pair. Add a supplementary-plane first character to guard code-point extraction. |
| A2: person portrait F loading → ready → error | Initials/tint while loading, picture on current ready, initials/tint on error; name visible and announced once throughout. No URL/header prop reaches Avatar. |
| A3: declared avatar under a different field name; a field named avatar with no presentation; hidden declared avatar | Only the explicitly declared visible candidate supplies a portrait. No naming convention bypass. |
| G1: empty, one, two, three and five distinct people; first named Ana | Empty draws nothing; one name; three discs maximum; five → three discs, `+2`, description `Ana and 4 others` / `Ana e mais 4 pessoas`. |
| G2: repeated person IDs, same ID in two resource namespaces, unresolved member | First duplicate within a resource removed; different resources remain distinct; unresolved member counts once and shows glyph. Both visual and spoken count agree with deduplicated membership. |
| M1: entry thumbnail = photoB, cover = photoA, both populated | Select B only. With no thumbnail declaration select A; with valid thumbnail but blank B select icon/none, never A. |
| M2: hidden/detail/hideList/wrong-presentation/nonexistent thumbnail; permitted cover | Invalid pointer is discarded; only a row-permitted cover can supply the default. No hidden metadata enters the UI model. |
| M3: picture absent; picture byte error; declared document icon; no icon | Both absent and error choose declared tile or no slot. Home absent icon chooses grid; ordinary list absent icon draws nothing. |
| M4: no picture door; malformed source `//elsewhere.test/{id}`, URL, query-token path, duplicate placeholder, dot/encoded traversal | No compact native request. Base row remains readable. Diagnostic names the path, never bearer or row content. |
| W1: widths [160, 640, 1280], slot 300, frame 1000; slot 1400; frame 200 at slot 300 | 640; 1280; 0. Empty widths/unknown slot → 0; unknown frame still selects 640 for a valid slot. These widths deliberately differ from the reference server's set. |
| P1: selected origin, file ID, source template, current bearer | Fake records exact same-origin substituted path, only a declared width, Authorization header, and no token in URL/cache/recycling keys. No current bearer → zero requests. |
| P2: fresh file metadata public + version; private; no metadata; stale public metadata | Adapter chooses memory only for fresh public/versioned input; all others none. No disk/preload/store call. Assert explicit namespaced cache key for memory. |
| P3: metadata 403/404 then late previous success; directory catalogue removed | Settle enrichment and remove former name/portrait; old completion cannot restore it. The authorized row/event remains. |
| P4: same file and URL across two accounts/servers or new session of same user | Distinct cache/recycling namespace; no former-session frame while loading. Memory-clear false/rejection does not restore access or prevent shell sign-out. |
| P5: source F1 → F2, then F1 ready/error callbacks; same ID new width/version/attempt; unmount | Only the current slot/resource callback changes state. Test reused slot and two simultaneous slots displaying the same file independently. |
| P6: API metadata session refusal versus opaque native onError | Existing API refusal triggers its shell boundary; opaque image error only triggers fallback. Never infer an HTTP code by matching native error text. |
| S1: task assignee/reference, content author, activity actor, account | Render Avatar via the same derivation and image renderer; generic non-person reference unchanged. User catalogue with no avatar produces initials; no undeclared profile read. System/unknown actors remain non-person. |
| S2: en/pt, light/dark, large text and reduced motion | No new English literal, fixed colour or non-scale distance; name/parent announced once, stack count correct, no nested press target, transitions zero, no clipped text. |

Add literal Gallery specimens for Avatar (initials, portrait, loading, failed,
unavailable name, long/non-Latin name), AvatarStack (0/1/3/5, duplicates,
unresolved), and RowMedia (picture, canvas loading, icon, error, none). Run them
in both themes. Keep every existing screen testID and flow assertion; a face
does not rename or replace the row's press target.

The served-catalogue fixture must come from an authorized GET to
`/api/v1/app/resources` on the public reference composition at the exact target
commit, with synthetic public test setup. Record commit, capture method and
SHA-256 beside the fixture; no credential, session identity, hostname of a
private deployment or invented picture hint. Assert the served `pictures`
source/widths and content's declared cover/thumbnail. The existing
`ui/screens/testdata/catalog.json` is only a note catalogue and does not contain
these declarations; it cannot be relabelled as evidence for them. Keep a
separately labelled synthetic example for a person with `present: avatar`,
because the reference user schema has no adopting portrait field. Synthetic
group/avatar cases prove renderer behavior, not a server feature.

Implementation verification order: run the narrow changed core and molecule
files first, relevant image/screen regressions next, then `npm run check` once
at the end. Run `make e2e-android` on the affected Home/list/detail/account
journey and record the exact flows and native cache observations. Device
verification must cover account switching, late image completion, private
remount and public cache reuse. Node/component suites cannot establish native
cache isolation, redirect header behavior, screen-reader output or live grants.
If no device/reference server is available, state those gaps explicitly.

## Dependency evidence

No dependency is added or upgraded. The named runtime libraries already exist
in the lockfile. Registry results below were read during specification; current
registry versions are evidence of existence, not requested upgrades. Each local
LICENSE file was read in full after this checkout's clean dependency install;
all three grant MIT permission with notice preservation and warranty disclaimer,
compatible with this repository's Apache-2.0 distribution.

| Library | Registry command and literal answer | Locked-version answer and LICENSE read |
| --- | --- | --- |
| `expo-image` | `npm view expo-image version license` → `version = '58.0.15'`, `license = 'MIT'` | `npm view expo-image@57.0.5 version license` → `version = '57.0.5'`, `license = 'MIT'`; `node_modules/expo-image/LICENSE`, MIT, copyright 650 Industries. |
| `react` | `npm view react version license` → `version = '19.3.1'`, `license = 'MIT'` | `npm view react@19.2.3 version license` → `version = '19.2.3'`, `license = 'MIT'`; `node_modules/react/LICENSE`, MIT, copyright Meta Platforms and affiliates. |
| `react-native` | `npm view react-native version license` → `version = '0.88.0'`, `license = 'MIT'` | `npm view react-native@0.86.3 version license` → `version = '0.86.3'`, `license = 'MIT'`; `node_modules/react-native/LICENSE`, MIT, copyright Meta Platforms and affiliates. |

`expo-image`'s installed `src/Image.types.ts` declares explicit `cacheKey` and
cache policy inputs; `src/Image.tsx` declares asynchronous `clearMemoryCache`
and its false-result platform limits. Reading these interfaces establishes an
adapter contract, not actual native-cache behavior on this handset.

## Limits

The product chooses who a field relates to, group membership/order, which
portrait field to declare, names, photos and consent, entry icons, cover versus
thumbnail, grants, server storage/retention policy and any specialist validation.
No client-specific rule enters the kit. Product custom renderers continue to
enter through the one existing renderer pack.

The reference identity/user schema has no avatar. Account and reference users
therefore gain initials now; a synthetic fixture exercises future declared
portraits without claiming they are served today. No profile editor, uploader,
cropper, avatar write, group membership query, external image service, content
cover hero, image viewer or new motion is included.

The brief's blanket “cached” promise is narrowed by the public file contract:
public/versioned images can use memory caching; private `no-store` images
cannot. A server-approved change to private cacheability is the server owner's
decision, not a native default. Public-to-private changes not notified to a
mounted phone are not instant revocation; new reads and catalogue/session
invalidation reauthorize. No offline-private-image promise is made.

The wire exposes server/actor identity rather than a tenant ID. The client uses
the selected tenant server origin and current identity/session generation; it
does not fabricate tenant scope. Switching tenant behind the same origin must
replace the session/catalogue through the existing shell lifecycle. Cross-host
redirect restrictions and actual native cache cleanup require device evidence.

Renamed/split: “avatar picture” means a field declared `present: avatar`, not a
field literally named avatar; “media slot” becomes one RowMedia molecule plus
Row's leading slot; “cached” is split by the server's public/private policy;
“blurhash or canvas” selects canvas because no hash is served. Nothing else in
the brief is dropped. API regeneration is specified as implementation's first
step and was deliberately not performed in this phase.


## Delivery evidence and limits

The implementation uses `file/file`, the metadata resource key actually served
by the pinned public composition. The earlier `file/files` spelling named the
URL collection rather than its catalog identity. `catalog.pictures.json` and
its receipt preserve a genuinely served response under a read-only scoped key;
they do not claim an adopting portrait field. Avatar/group examples are synthetic.
The unrestricted administrator response also exposes unrelated translation map
inputs beyond this client's supported field kinds, which remain refused. The
read-scoped fixture proves only the public shape and actor scope it records.

Explicit list/detail visits renew enrichment and image attempts on refresh,
retaining the prior answer while reading and on transport/5xx failure within
the same session and catalog. Successful reads replace prior projections; explicit
401/403/404 refusals withdraw them. Session/catalog changes immediately withdraw
prior resources. Adding another page retains the bounded directory page and
per-file metadata promises. Image slot identities distinguish simultaneous uses of the same file.
The native cache-clear call enters through `NativeImage`; the effects helper
receives it as an explicit function because effects import no Expo image module.
The theme's status-pair helper is shared by badges and avatars.

No native project or dependency changes are required. Android/iOS, native byte
loading/caching/redirects, revocation and screen-reader behavior need device
verification; component evidence alone does not establish them.
