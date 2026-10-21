// decidePack is the Decide module's own screens, keyed the way the dispatcher looks a pack up. It
// is a function rather than an object because the invite sheet's two product facts — how a link is
// composed and how long a credential lives — arrive from the app that composes it: the kernel prints
// a token and an expiry, and a kit that guessed a host would be guessing a client.
//
// Every kind it leaves out stays generated: the card's detail and any command sheet are derived well
// from the entry, and a pack that redrew them would be a second implementation of them.
import type { Renderers } from "../renderers";
import { AskQuestion } from "./decide/ask";
import { InviteBlock, type InvitePorts } from "./decide/invite";
import { QuestionResults } from "./decide/results";
import { QuestionList } from "./decide/questions";
import { VoteDeck } from "./decide/vote";

/**
 * decidePack is passed to `<Shell>` once, under the module's two keys. A product that supplies no
 * invite ports gets the roster and no link: the sheet draws neither a QR nor a URL, because a
 * credential pointed at an address nobody composed would be a QR of a guess.
 */
export function decidePack(ports: InvitePorts = {}): Renderers {
  return {
    "decide/questions": {
      list: QuestionList,
      form: AskQuestion,
      detail: (props) => <QuestionResults {...props} {...(ports === undefined ? {} : { ports })} />,
    },
    "decide/card": { deck: VoteDeck },
  };
}

export { InviteBlock };
export type { InvitePorts };
