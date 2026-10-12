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
import { Text } from "react-native";
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
        // A hard break is the author's own line ending, drawn as one; a soft break is
        // a word wrap, which the phone reads as the space the browser gives it.
        hardbreak: (node) => <Text key={node.key}>{"\n"}</Text>,
        softbreak: (node) => <Text key={node.key}> </Text>,
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
 *
 * The keys are the library's own — `s`, `code_inline`, `code_block`, `fence`, `thead` —
 * and a style written under any other name is silently never drawn, leaving whatever
 * the library ships as its default in that place. Text roles sit on the block that
 * holds the text (the paragraph, the heading, the list, the table, the code), not on
 * `body` or `text`: the face resolves a leaf's font by walking its ancestors with the
 * outermost wins, so a face written on `body` would answer for every heading too, and
 * a weight or a face written lower down survives only because nothing above it names
 * that same property.
 */
function proseStyles(t: Theme): Record<string, Record<string, unknown>> {
  // The kit's reading role: everything that is ordinary text, wherever it sits.
  const text = {
    color: t.color.textPrimary,
    fontFamily: t.font.body,
    fontSize: t.type.body.size,
    lineHeight: t.type.body.line,
  };
  // A heading has the display face and the scale's own size for its level; §1 has no
  // `#` (the record's title owns that) and nothing below `####`, so the four lines the
  // format allows land on the two faces the kit has for a heading.
  const heading = (role: keyof Theme["type"]) => ({
    ...text,
    fontFamily: t.font.display,
    fontSize: t.type[role].size,
    lineHeight: t.type[role].line,
    marginTop: t.space.lg,
    marginBottom: t.space.xs,
  });
  // Code is drawn in the mono face on the palette's own muted surface, in both modes:
  // the library's default is a light box with a grey border, which in dark mode puts
  // light ink on a light ground.
  const code = {
    backgroundColor: t.color.surfaceMuted,
    borderColor: t.color.borderDefault,
    borderRadius: t.radius.md,
    borderWidth: 1,
    color: t.color.textPrimary,
    fontFamily: t.font.mono,
    fontSize: t.type.caption.size,
    lineHeight: t.type.caption.line,
    padding: t.space.sm,
  };
  return {
    paragraph: { ...text, marginVertical: t.space.xs },
    heading1: heading("title"),
    heading2: heading("title"),
    heading3: heading("label"),
    heading4: heading("label"),
    heading5: heading("label"),
    heading6: heading("label"),
    strong: { fontWeight: "700" },
    em: { fontStyle: "italic" },
    s: { textDecorationLine: "line-through" },
    link: { color: t.color.accentDefault, textDecorationLine: "underline" },
    blockquote: {
      ...text,
      color: t.color.textMuted,
      backgroundColor: t.color.surfaceMuted,
      borderColor: t.color.borderStrong,
      borderLeftWidth: 3,
      marginLeft: t.space.xs,
      paddingHorizontal: t.space.md,
      paddingVertical: t.space.xs,
    },
    bullet_list: text,
    ordered_list: text,
    list_item: { marginVertical: t.space.xs / 4 },
    code_inline: code,
    code_block: code,
    fence: code,
    hr: {
      backgroundColor: t.color.borderDefault,
      height: t.space.xs / 4,
      marginVertical: t.space.md,
    },
    table: {
      ...text,
      borderWidth: 1,
      borderColor: t.color.borderDefault,
      borderRadius: t.radius.md,
    },
    thead: { backgroundColor: t.color.surfaceMuted },
    // A row's rule is the palette's, drawn under every cell but the last.
    tr: { borderBottomWidth: 1, borderColor: t.color.borderDefault },
    th: { fontWeight: "700", padding: t.space.sm },
    td: { padding: t.space.sm },
  };
}
