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
  // One name for this reader, and every block and figure under it is named from it: two
  // rich text bodies on one screen are then two readers a journey can tell apart, while a
  // reader nobody names keeps the plain `prose` names it has always had.
  const at = testID ?? "prose";
  return (
    <View style={s.body} {...testable(at)}>
      {model.blocks.map((block) =>
        block.kind === "markdown" ? (
          <View key={block.id} {...testable(`${at}-${block.id}`)}>
            {renderMarkdown(block.source, block.id)}
          </View>
        ) : (
          <Figure
            key={block.id}
            figure={block}
            scope={at}
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
  scope,
  renderFigure,
  onOpenFigure,
  onRetryFigure,
}: {
  readonly figure: ProseBlockModel & { kind: "figure" };
  readonly scope: string;
  readonly renderFigure?: Props["renderFigure"] | undefined;
  readonly onOpenFigure?: ((id: string) => void) | undefined;
  readonly onRetryFigure?: ((id: string) => void) | undefined;
}) {
  const s = useStyles(styles);
  const open = figure.canOpen && onOpenFigure !== undefined;
  // A decorative figure says nothing to a person listening either: the picture carries
  // no words and the frame has no affordance, so the whole block leaves the tree rather
  // than being announced as something to open.
  const decorative = figure.slot?.decorative ?? false;
  // The box is reserved by the measurements the server took of the file itself, so a
  // paragraph below a figure does not move when its bytes arrive. No frame yet means
  // nothing is reserved: the skeleton says so at its own height.
  const box = figure.slot ? { aspectRatio: figure.slot.aspectRatio } : undefined;
  return (
    <View
      style={s.figure}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
      {...testable(`${scope}-figure-${figure.id}`)}
    >
      <Pressable
        accessible
        accessibilityRole={open ? "imagebutton" : "image"}
        accessibilityLabel={spoken(figure)}
        accessibilityHint={open ? figure.openLabel : undefined}
        disabled={!open}
        onPress={() => onOpenFigure?.(figure.id)}
        {...testable(`${scope}-figure-open-${figure.id}`)}
      >
        <View style={[s.box, box]}>
          {/* The loader is mounted from the first frame, not from the first byte: the ask
              for a picture is what turns `loading` into `ready`, so a slot that waited for
              `ready` before mounting it would wait forever. The placeholder is drawn under
              it, in the box the server's own measurements reserved, and the picture paints
              over it as it arrives. */}
          {figure.state === "loading" ? (
            <Skeleton
              label={figure.loadingLabel}
              motion={figure.motion}
              testID={`${scope}-figure-loading-${figure.id}`}
            />
          ) : null}
          {figure.canRetry ? (
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
          testID={`${scope}-figure-retry-${figure.id}`}
        />
      ) : null}
    </View>
  );
}

/**
 * spoken is what a person hearing the screen is told about one figure: the one thing it
 * is. The figure that opens is invited by name; a box whose bytes have not arrived is
 * loading; a box that was refused names the reason the server gave; and a decorative
 * picture has nothing to say, so nothing is said. An "Open" over any of the last three
 * is a promise the figure cannot keep, and a screen reader would make three of them.
 */
function spoken(figure: ProseBlockModel & { kind: "figure" }): string | undefined {
  if (figure.slot?.decorative ?? false) return undefined;
  if (figure.canRetry) return figure.reason;
  if (figure.state === "loading" || figure.slot === undefined) return figure.loadingLabel;
  return figure.canOpen
    ? `${figure.openLabel}, ${figure.slot?.description ?? ""}`
    : figure.slot?.description;
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
