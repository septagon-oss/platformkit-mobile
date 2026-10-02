import React from "react";
import { DetailSurface, type DetailSurfaceProps } from "./DetailSurface";
export function SidePanel(props: DetailSurfaceProps & { readonly mode: "modal" | "docked" }) {
  return <DetailSurface {...props} />;
}
