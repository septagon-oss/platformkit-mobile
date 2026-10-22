// QrCode draws a matrix from src/core/qr.ts at a fixed side, with the light border a reader needs
// around it. It decides nothing about the text: a matrix that is too dense to draw is the caller's
// refusal to make, and this draws the one it is handed.
import React from "react";
import { Svg, Rect } from "react-native-svg";
import type { QrMatrix } from "../../core/qr";
import { QR_QUIET_ZONE } from "../../core/qr";
import { useTheme } from "../theme";
import { extent } from "../scale";
import { testable } from "../props";

/**
 * side is the drawn edge in points; modules per side counts the quiet zone in, so the symbol keeps
 * its proportion whatever the matrix holds. A symbol is drawn as one rect per dark module because
 * that is what a screen reader and a screenshot both agree on; a path would be smaller and no more
 * legible.
 */
export function QrCode({
  matrix,
  label,
  testID,
}: {
  readonly matrix: QrMatrix;
  readonly label: string;
  readonly testID?: string;
}) {
  const t = useTheme();
  const side = extent.qr;
  const modules = matrix.size + QR_QUIET_ZONE * 2;
  const module = side / modules;
  const dark: React.ReactNode[] = [];
  for (let row = 0; row < matrix.size; row++)
    for (let column = 0; column < matrix.size; column++)
      if (matrix.modules[row * matrix.size + column])
        dark.push(
          <Rect
            key={`${row}-${column}`}
            x={(column + QR_QUIET_ZONE) * module}
            y={(row + QR_QUIET_ZONE) * module}
            width={module}
            height={module}
            fill={t.color.textPrimary}
          />,
        );
  return (
    <Svg width={side} height={side} role="img" accessibilityLabel={label} {...testable(testID)}>
      <Rect x={0} y={0} width={side} height={side} fill={t.color.surfacePrimary} />
      {dark}
    </Svg>
  );
}
