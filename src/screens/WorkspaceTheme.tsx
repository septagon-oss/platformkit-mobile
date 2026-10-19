// WorkspaceTheme is where a workspace's colour becomes the palette the app is painted
// with. It sits between the shell and the theme in the composition root, because that is
// the one place the workspace is known and the theme is set: the theme layer takes a
// palette in and knows nothing about where it came from, and the shell draws nothing and
// so owns no paint.
//
// Nothing here is a second theme. The palette handed down is the generated pair with its
// accent roles worn by the workspace (src/ui/theme.tsx's `accentPalette`), and every
// component keeps reading `color.accentDefault` and its two siblings from `useTheme()` —
// which is why a workspace's colour reaches a button, a pill, a link, Home's band and the
// native header without any of them being told about a workspace.
import React, { useMemo } from "react";
import { useShell } from "../shell";
import { accentPalette, ThemeProvider } from "../ui/theme";
import { palette } from "../ui/tokens";

interface Props {
  readonly children: React.ReactNode;
}

export function WorkspaceTheme({ children }: Props) {
  const { workspace } = useShell();
  // A refused accent is the generated object itself, so the memo settles and a workspace
  // with nothing to say costs no re-render below the provider.
  const worn = useMemo(() => accentPalette(palette, workspace.accent), [workspace.accent]);
  return <ThemeProvider palette={worn}>{children}</ThemeProvider>;
}
