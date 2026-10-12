# The duplicate search, and what it came back with

0088 rule 3 merges a test only when another test proves the same rule, and warns that identical line coverage
does not mean identical assertions. Two mechanical searches were run over the 232 discovered files; both are
recorded here with their output so a reviewer can re-run them.

## Search 1 — coverage containment (leave-one-out): useless, and that is the finding

For every pair (A, B) in one runner: is every production line A covers also covered by B?
**189 of 232 files have their whole production coverage contained in another file's** — because the component
suites all load the same `src/core` and `src/ui` units (a suite loads 100–150 source files on average). A gate
built on this column would merge almost the whole suite. Recorded as evidence for 0088's warning; it decides
nothing.

## Search 2 — same runner, same imported subject, zero exclusive lines, rule words ≥30 % alike

```
$ python3 shortlist.py            # per runner, over the isolated coverage runs
total candidate pairs: 8   files with a candidate: 8
```

Eight files, four pairs. All four read by hand:

| pair | what each proves | verdict |
|---|---|---|
| `tests/ui/dialog-busy-backdrop.test.tsx` / `tests/ui/dialog-idle-backdrop.test.tsx` | busy: cancel is off on the button, the backdrop and the back gesture, because a dialog dismissed mid-write leaves the screen silent about a live write. idle: all three *are* the same cancel and all three must work, or the person is trapped. Opposite polarity, same surface — the idle file exists to catch a cure that turns cancel off everywhere. | **keep both** (complementary boundary case, 0088) |
| `tests/shell-concurrent-sign-ins.test.tsx` / `tests/shell-session-catalog-isolation.test.tsx` | a late first sign-in cannot replace the second session; an obsolete session catalog cannot replace a newer session catalog. Same race shape, different loser (credentials vs the catalogue document). | **keep both** |
| `tests/screens/activity-directory-read-order.test.tsx` / `tests/screens/activity-directory-pagination.test.tsx` | the order the trail is read in vs the pages it arrives over. | **keep both** |
| `tests/screens/custom-renderer-session-isolation.test.tsx` / `tests/screens/custom-renderer-catalog-withdrawal.test.tsx` | a custom renderer's session isolation vs a catalogue withdrawal reaching the same renderer. | **keep both** |

`merge: 0`, `delete: 0`, with the candidates and the readings named. The prune task inherits this file: a
verdict it wants to change must add a sibling and an assertion-to-successor mapping to the JSON row.
