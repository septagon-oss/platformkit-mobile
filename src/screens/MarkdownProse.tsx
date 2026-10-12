// MarkdownProse is the kit's Markdown face: one text run of a rich text body drawn in
// the kit's type, with no colour, face or distance written here that does not come
// from a token. It is a screen adapter because it is where a Markdown library enters
// the phone — `src/ui/` draws what it is handed and knows no library, and the
// organism (src/ui/organisms/Prose.tsx) owns the order of the blocks and their words.
//
// The library draws text only. An image inside a run is drawn as nothing: 0069 §1
// keeps every image as a figure of its own, which the core's segmentation already
// separated out, and a picture that escaped its figure is a body the server would not
// have stored — not something this face resolves with a fetch of its own, since the
// bytes of a file belong to the authenticated read (src/effects/media.ts).
import React, { useMemo } from "react";
import Markdown from "react-native-markdown-display";
import { useTheme, type Theme } from "../ui/theme";

/**
 * MarkdownProse renders one run of a normalised body. Unknown Markdown is drawn as
 * the library draws it: this face adds no rule and repairs nothing.
 */
export function MarkdownProse({ source }: { readonly source: string }) {
  const theme = useTheme();
  const styles = useMemo(() => proseStyles(theme), [theme]);
  return (
    <Markdown
      style={styles}
      rules={{
        image: () => null,
        hardbreak: () => "\n",
      }}
    >
      {source}
    </Markdown>
  );
}

/**
 * proseStyles is the library's style sheet in the kit's roles: the type scale, the
 * surface a code block sits on, the rule a quote hangs from. Both modes come from the
 * same generated palette (src/ui/tokens.ts), which is why no line below names a colour.
 */
function proseStyles(t: Theme): Record<string, Record<string, unknown>> {
  const body = {
    color: t.color.textPrimary,
    fontFamily: t.font.body,
    size: t.type.body.size,
    lineHeight: t.type.body.line,
  };
  const heading = (role: keyof Theme["type"]) => ({
    ...body,
    fontFamily: t.font.display,
    size: t.type[role].size,
    lineHeight: t.type[role].line,
    marginTop: t.space.lg,
    marginBottom: t.space.xs,
  });
  return {
    body: { ...body, fontWeight: "400" },
    paragraph: { ...body, marginVertical: t.space.xs },
    // §1 has no `#` (the record's own title owns it) and nothing below `####`, so the
    // four lines the format allows land on the two faces the kit has for a heading.
    heading1: heading("title"),
    heading2: heading("title"),
    heading3: heading("label"),
    heading4: heading("label"),
    heading5: heading("label"),
    heading6: heading("label"),
    strong: { ...body, fontWeight: "700" },
    em: { ...body, fontStyle: "italic" },
    del: { ...body, textDecorationLine: "line-through" },
    link: { ...body, color: t.color.accentDefault },
    blockquote: {
      ...body,
      borderLeftWidth: 3,
      borderLeftColor: t.color.accentDefault,
      paddingLeft: t.space.md,
      color: t.color.textMuted,
    },
    pre: {
      backgroundColor: t.color.surfaceMuted,
      borderRadius: t.radius.md,
      padding: t.space.md,
    },
    code: {
      fontFamily: t.font.mono,
      fontSize: t.type.caption.size,
      color: t.color.textPrimary,
    },
    inlineCode: {
      fontFamily: t.font.mono,
      fontSize: t.type.caption.size,
      backgroundColor: t.color.surfaceMuted,
      color: t.color.textPrimary,
    },
    hr: {
      backgroundColor: t.color.borderDefault,
      height: t.space.xs / 4,
      marginVertical: t.space.md,
    },
    list_item: { ...body, marginVertical: t.space.xs / 4 },
    bullet_list: { ...body, paddingVertical: t.space.xs / 2 },
    ordered_list: { ...body, paddingVertical: t.space.xs / 2 },
    table: { borderWidth: 1, borderColor: t.color.borderDefault, borderRadius: t.radius.md },
    th: { ...body, fontWeight: "700", padding: t.space.sm },
    td: { ...body, padding: t.space.sm },
    tr: { borderColor: t.color.borderDefault },
    table_head: { backgroundColor: t.color.surfaceMuted },
    text: body,
  };
}
