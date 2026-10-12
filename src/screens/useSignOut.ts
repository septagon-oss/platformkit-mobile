// useSignOut is the one way out of a sign-in, and the one place that decides
// what it costs. Signing out clears what this phone is holding, so every door
// that leaves asks first while a write is held and names the count: the person's
// own work is never thrown away by a button that looked like a change of server.
// The screen that offers the door decides where it appears; the question, its
// words and what a yes does live here, so a second way out cannot forget them.
import { useCallback } from "react";
import { useShell } from "../shell";
import { confirm } from "../ui/chooser";
import { useTheme } from "../ui/theme";
import { useFeedback } from "./useFeedback";

/** useSignOut answers the act of leaving: it asks when leaving would discard held work, and signs out otherwise. */
export function useSignOut(): () => void {
  const { signOut, outbox } = useShell();
  const { copy } = useFeedback();
  const { mode } = useTheme();
  return useCallback(() => {
    const owed = outbox?.items.length ?? 0;
    if (owed === 0) {
      void signOut();
      return;
    }
    confirm(
      copy.state.signOutHeld(owed),
      {
        label: copy.state.discard,
        destructive: true,
        onPress: () => void signOut(),
      },
      mode,
      { cancel: copy.state.keep },
    );
  }, [signOut, outbox, copy, mode]);
}
