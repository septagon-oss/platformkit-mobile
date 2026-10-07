// verb.tsx holds one rule of the composition: a screen offers one filled verb —
// the thing a person came here to do. Every other specimen on it draws its
// verbs in the outlined ink, so nothing on the screen competes with that one
// thing for the eye. The page says once which subtree holds the verb; a control
// asks, instead of every screen being written to remember to pass a prop down.
import React, { createContext, useContext } from "react";

const Stage = createContext(true);

interface Props {
  /** lead says this subtree holds the screen's one filled verb; the others are outlined. */
  readonly lead: boolean;
  readonly children: React.ReactNode;
}

export function VerbStage({ lead, children }: Props) {
  return <Stage.Provider value={lead}>{children}</Stage.Provider>;
}

/** useVerbStage answers whether this subtree holds the screen's filled verb. */
export const useVerbStage = (): boolean => useContext(Stage);
