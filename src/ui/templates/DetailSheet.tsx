import React from "react";
import { DetailSurface, type DetailSurfaceProps } from "./DetailSurface";
export function DetailSheet(props: DetailSurfaceProps) {
  return <DetailSurface {...props} mode="modal" />;
}
