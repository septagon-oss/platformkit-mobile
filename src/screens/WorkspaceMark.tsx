// WorkspaceMark draws the mark a workspace named for itself, on the screen that is
// identifying that place: the connect step, the credentials under it, the rows of workspaces
// this phone remembers, Home's greeting. The mark is a path the workspace's own answer named,
// joined to the address that named it and handed to the app's own image view — the kit never
// fetches a logo of its own, and never sends a key with one.
//
// A mark that never arrives is no image and nothing else is said: the name and the colour
// came from a different answer, and a broken picture on the first screen is not a fact
// about the workspace.
import React, { useState } from "react";
import { workspaceMarkURI, type Workspace } from "../core/workspace";
import type { ImageSlotProps } from "../core/derive";
import type { ImageResource } from "../effects/media";
import { useShell } from "../shell";
import { NativeImage } from "./NativeImage";

interface Props {
  /** description is what the mark is called to a reader: the workspace's own name. */
  readonly description: string;
  /**
   * face is whose mark to draw, for a mark this phone kept rather than read — a remembered
   * workspace's row. Left out it is the workspace this shell is wearing, which is the one a
   * screen is identifying. Either way the origin the mark is asked of comes from the face and
   * is nothing the screen chooses.
   */
  readonly face?: Workspace | undefined;
}

export function WorkspaceMark({ description, face }: Props) {
  const { workspace } = useShell();
  const worn = face ?? workspace;
  // The origin travels inside the face, so there is no address at this call site to get
  // wrong: a phone that was pointed at one server and then connected to another asks the
  // second one for the mark the second one named.
  const uri = workspaceMarkURI(worn);
  // One identity per mark, and the failure is filed against the mark that met it: a new
  // answer is a new question, and a mark that never arrived at one address says nothing
  // about the next. The image's own report is the only writer, so nothing is set while
  // this renders and no effect is needed to forget the last mark's failure.
  const identity = `${worn.host}${uri}`;
  const [broken, setBroken] = useState("");
  if (uri === "" || broken === identity) return null;
  const model: ImageSlotProps = {
    id: "mark",
    instance: identity,
    description,
    decorative: false,
    fit: "contain",
    aspectRatio: 1,
  };
  const resource: ImageResource = {
    scope: "workspace",
    id: "mark",
    version: worn.host,
    uri,
  };
  return (
    <NativeImage
      model={model}
      resource={resource}
      onState={(_id, state) => setBroken(state === "error" ? identity : "")}
    />
  );
}
