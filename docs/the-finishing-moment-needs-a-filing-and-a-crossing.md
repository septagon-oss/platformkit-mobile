# Why the finishing moment needs both a filing and a crossing

A record that reaches a state its entry calls _finished_ is the one change on this phone a person may
not have seen coming: it is the end of the thing they were looking at, and it arrived while they were
looking. Saying so is worth doing. Saying so whenever a state is _seen_ is worse than saying nothing,
because most states this phone sees it did not cause.

Two facts are needed to know that this person finished this record, and neither one is readable from
the other.

**The filing** — _did this phone write here?_ No screen can answer that from the row it is holding: a
row carries a state, not a cause. The row a record screen reads looks identical whether the person
archived it a moment ago or a colleague archived it while they were on the phone. So the write says
where it landed. In `useCommandAsk`, `useCommandForm` and `useResourceForm.save`, the accepted write
calls `celebrate(address("detail", entry, id))` on the shell, beside the one sentence a write already
leaves there for `heard`. A create files nothing, because the record it made did not change state
under anybody. A command over a whole collection files nothing, because it has no record to land on. A
write this phone is holding in its outbox has not run, so it files nothing either. And a refused write
returns before the filing.

**The crossing** — _did the state actually move?_ The filing alone is not enough either, and this is
where the tempting shortcut fails. A write that files and then celebrates would celebrate a record
that was _already_ finished before the person touched it — the ordinary case of archiving an archived
thing, or fixing a title on a task someone else resolved. The record screen therefore keeps the row it
last drew (`drawn`), and a moment is owed only when the row it now reads is finished and the row it
showed a moment ago was not. An answer that came out of this phone's own read cache is not an answer:
it is a memory of one, and the state it carries is as old as the tunnel.

Neither half may be dropped. Filing alone celebrates somebody else's work. Crossing alone celebrates
a refresh, a pull-to-refresh, a re-authentication, and every other read that answers late.

Two more rules keep the moment honest once it exists.

_One moment per record per session._ A record's screen can be mounted twice in a stack, and a person
can go back to a record and look at it again; a burst on every arrival would say the same thing twice
about one event. The shell holds the set of records whose moment has _played_ this session, and a
write to a record already in it files nothing. The set is cleared when what a refused session left
behind is forgotten, next to the sentence and the draft, because a new session has not seen this one's
finishing.

_The moment spends itself, not the record._ This one is subtle enough to have been got wrong once. The
address used to join that set when the write filed it, which reads as the same rule and is not: most
writes to a record finish nothing. The task that gets acknowledged first, then resolved — the ordinary
path a task takes on a phone — had its moment spent by the acknowledgement, which never drew a line,
and the resolve that actually finished it had nothing left to spend. So the set is joined when the
moment _plays_, and a filing whose read crossed nothing leaves the record eligible for the write that
does finish it. The check stays a check; only the moment of joining moved.

The filing is spent by the next read that answers, crossed or not, and by a read that was refused too.
A filing that survived a failed read would sit waiting, and a Retry pressed minutes later — after the
server answered, after somebody else moved the state — would celebrate a change nobody here made.
