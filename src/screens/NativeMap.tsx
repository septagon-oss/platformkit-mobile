// The specified SDK is native. Web consumers receive an explicit unsupported state.
import React from "react";
import type { MapCanvasProps } from "../core/derive";
import type { MapResource } from "../effects/media";
import { Notice } from "../ui/atoms/Notice";
export interface Props {
  readonly model: MapCanvasProps;
  readonly resource: MapResource;
  readonly unsupportedLabel: string;
  readonly onState: (state: "ready" | "error") => void;
}
export function NativeMap({ unsupportedLabel }: Props) {
  return <Notice text={unsupportedLabel} announcement="polite" />;
}
