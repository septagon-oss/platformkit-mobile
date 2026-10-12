// Prose is a rich text body as the phone reads it: the runs the core cut, drawn by
// whoever owns a Markdown face, and the figures the same cut found, drawn by whoever
// owns an image loader. This file decides the order and the words — a caption under
// its figure, a refusal in place of a picture that did not arrive, and a figure that
// opens full screen for the person who wants to see it whole.
//
// It holds no renderer and fetches no byte: the text slot and the image slot come in
// as props, the way PhotoViewer's do, so a Markdown library and a session cookie stay
// out of this layer (src/ui/ never imports a transport or an SDK).
import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { ProseBlockModel, ProseModel } from "../../core/prose";
import { Button } from "../atoms/Button";
import { Skeleton } from "../atoms/Skeleton";
import { Text } from "../atoms/Text";
import { testable } from "../props";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly model: ProseModel;
  /** renderMarkdown draws one text run in the kit's type. The screen supplies the face. */
  readonly renderMarkdown: (source: string, id: string) => ReactNode;
  /**
   * renderFigure fills one figure's reserved box. Absent means this surface draws no
   * picture at all, which leaves the caption and the words about a missing image.
   */
  readonly renderFigure?: (figure: ProseBlockModel & { kind: "figure" }) => ReactNode;
  /** onOpenFigure opens the full-screen viewer for one figure; no handler, no affordance. */
  readonly onOpenFigure?: (id: string) => void;
  /** onRetryFigure asks for one figure again; a surface that cannot retry draws no control. */
  readonly onRetryFigure?: (id: string) => void;
  readonly testID?: string;
}

export function Prose({
  model,
  renderMarkdown,
  renderFigure,
  onOpenFigure,
  onRetryFigure,
  testID,
}: Props) {
  const s = useStyles(styles);
  return (
    <View style={s.body} {...testable(testID ?? "prose")}>
      {model.blocks.map((block) =>
        block.kind === "markdown" ? (
          <View key={block.id} {...testable(`prose-${block.id}`)}>
            {renderMarkdown(block.source, block.id)}
          </View>
        ) : (
          <Figure
            key={block.id}
            figure={block}
            renderFigure={renderFigure}
            onOpenFigure={onOpenFigure}
            onRetryFigure={onRetryFigure}
          />
        ),
      )}
    </View>
  );
}

/**
 * Figure is one block image: the box the server's own measurements reserve, so a
 * paragraph below it never moves when the byte arrives; the caption the author wrote;
 * and, when the picture did not arrive, the same words every other missing image in
 * the kit says, with the way back.
 */
function Figure({
  figure,
  renderFigure,
  onOpenFigure,
  onRetryFigure,
}: {
  readonly figure: ProseBlockModel & { kind: "figure" };
  readonly renderFigure?: Props["renderFigure"] | undefined;
  readonly onOpenFigure?: ((id: string) => void) | undefined;
  readonly onRetryFigure?: ((id: string) => void) | undefined;
}) {
  const s = useStyles(styles);
  const open = figure.canOpen && onOpenFigure !== undefined;
  // The box is reserved by the measurements the server took of the file itself, so a
  // paragraph below a figure does not move when its bytes arrive. No frame yet means
  // nothing is reserved: the skeleton says so at its own height.
  const box = figure.slot ? { aspectRatio: figure.slot.aspectRatio } : undefined;
  return (
    <View style={s.figure} {...testable(`prose-figure-${figure.id}`)}>
      <Pressable
        accessible
        accessibilityRole={open ? "imagebutton" : "image"}
        accessibilityLabel={
          figure.slot && !figure.slot.decorative
            ? `${figure.openLabel}, ${figure.slot.description}`
            : figure.openLabel
        }
        accessibilityHint={open ? figure.openLabel : undefined}
        disabled={!open}
        onPress={() => onOpenFigure?.(figure.id)}
        {...testable(`prose-figure-open-${figure.id}`)}
      >
        <View style={[s.box, box]}>
          {figure.state === "loading" ? (
            <Skeleton
              label={figure.loadingLabel}
              motion={figure.motion}
              testID={`prose-figure-loading-${figure.id}`}
            />
          ) : figure.canRetry ? (
            <Text role="caption" tone="muted">
              {figure.reason}
            </Text>
          ) : (
            renderFigure?.(figure)
          )}
        </View>
      </Pressable>
      {figure.caption === "" ? null : (
        <Text role="caption" tone="muted">
          {figure.caption}
        </Text>
      )}
      {figure.canRetry && onRetryFigure ? (
        <Button
          label={figure.retryLabel}
          tone="plain"
          motion={figure.motion}
          onPress={() => onRetryFigure(figure.id)}
          testID={`prose-figure-retry-${figure.id}`}
        />
      ) : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    body: { gap: t.space.sm },
    figure: { gap: t.space.xs / 2, paddingVertical: t.space.xs },
    box: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderRadius: t.radius.md,
      backgroundColor: t.color.surfaceMuted,
    },
  });
