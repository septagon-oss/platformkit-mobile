// outfitPack is the outfit module's own screens, keyed the way the dispatcher looks a pack up. It is
// a plain `Renderers` record and a function rather than an object or a declaration for two reasons:
// the module mounts no route, so the two addresses are the composition's — a kit that guessed a host
// would be holding a client fact — and a projection the pinned document prints no operation for has
// no typed read to declare, which is the case `src/pack.ts` leaves this record for.
//
// Every kind it leaves out stays generated: a look is opened, kept and listed by the machinery every
// other entry goes through, and a pack that redrew those would be a second implementation of them.
import type { Renderers } from "../renderers";
import { OutfitLook } from "./outfit/look";
import { OutfitLooks } from "./outfit/looks";
import type { OutfitPorts } from "./outfit/read";

/**
 * outfitPack is passed to `<Shell>` once, under the module's one key. A composition that changes
 * nothing gets the kit's own spelling of the two reads; one that changes them passes the doors and
 * nothing else moves.
 */
export function outfitPack(ports: OutfitPorts = {}): Renderers {
  return {
    "outfit/look": {
      list: (props) => <OutfitLooks {...props} ports={ports} />,
      detail: (props) => <OutfitLook {...props} ports={ports} />,
    },
  };
}

export type { OutfitPorts };
