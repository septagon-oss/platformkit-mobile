import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWindowDimensions } from "react-native";
import { offers } from "../core/catalog";
import {
  enrichmentFailure,
  fileMeta,
  noMeta,
  pictureId,
  type FileMeta,
  type ImageSlotProps,
  type PictureStates,
  type Row,
} from "../core/derive";
import { variantWidth } from "../core/prose";
import { fileResource } from "../effects/files";
import type { ImageResource } from "../effects/media";
import { useShell } from "../shell";
import { extent } from "../ui/scale";
import { NativeImage } from "./NativeImage";
import { failureFacts } from "./failure";

interface FileRead {
  /** metadata identifies the applied answer so reusing its promise does not reset loaded slots. */
  readonly resource?: ImageResource | undefined;
  readonly retain?: boolean;
  readonly signedOut?: boolean;
  /** meta is what the read answered of the file itself: the frame it probed and the caption it holds. */
  readonly meta?: FileMeta | undefined;
}
interface Picture {
  readonly metadata: FileRead;
  readonly meta: FileMeta;
  readonly resource: ImageResource | undefined;
  readonly states: PictureStates;
}

/**
 * usePictures binds session-owned bytes to decorative slots, coalescing metadata per file and attempt.
 * A changed attempt (0 by default) refreshes metadata while retaining the same session's resources;
 * transient failures retain them, explicit refusals withdraw them, and scope changes discard them.
 * `width` is how wide a slot draws the file in points (a row's picture by default), so the door asks
 * for the variant that fits; `files` answers the metadata read for each id, which is what a surface
 * needs to draw a picture in its own shape and to name it.
 */
export function usePictures(
  ids: readonly string[],
  attempt: unknown = 0,
  width: number = extent.rowMedia,
) {
  const { api, baseURL, identity, state, entry } = useShell();
  const mount = useId();
  const viewport = useWindowDimensions();
  const key = api.bearer();
  const pictures = state.catalog?.pictures;
  const wanted = [...new Set(ids.filter(pictureId))].sort().join(",");
  const selected = useMemo(() => wanted.split(",").filter(Boolean), [wanted]);
  const files = entry("file", "file");
  const scope = useMemo(
    () => ({
      api,
      baseURL,
      user: identity?.userId,
      key: key?.id,
      catalog: state.catalog,
      namespace: JSON.stringify([mount, state.generation]),
    }),
    [api, baseURL, identity?.userId, key?.id, state.catalog, state.generation, mount],
  );
  const sequence = useRef(0);
  const request = useMemo(
    () => ({
      scope,
      attempt,
      pixels: width * viewport.scale,
      pending: new Map<string, Promise<FileRead>>(),
    }),
    [scope, attempt, viewport.scale, width],
  );
  const current = useRef<typeof request | undefined>(request);
  const [loaded, setLoaded] = useState<{
    scope: typeof scope;
    files: Readonly<Record<string, Picture>>;
    signedOut: boolean;
  }>();
  useLayoutEffect(() => {
    current.current = request;
    return () => {
      if (current.current === request) current.current = undefined;
    };
  }, [request]);
  const enabled = !!pictures && !!identity?.userId && !!key && state.phase === "ready";
  useEffect(() => {
    if (!enabled || !pictures) return;
    let active = true;
    const generation = JSON.stringify([scope.namespace, ++sequence.current]);
    const read = async (id: string): Promise<FileRead> => {
      let row: Row | undefined;
      let retain = false;
      if (files && offers(files, "read")) {
        try {
          row = await api.get(files, id);
        } catch (e) {
          const verdict = enrichmentFailure(failureFacts(e));
          if (verdict === "signed-out") return { signedOut: true };
          if (verdict === "withdraw") return {};
          retain = true;
        }
      }
      const meta = fileMeta(row);
      const resource = fileResource({
        server: baseURL,
        userId: identity?.userId,
        key: api.bearer(),
        entry: files,
        pictures,
        id,
        version: typeof row?.sha256 === "string" && row.sha256.trim() ? row.sha256 : "",
        public: row?.visibility === "public",
        generation,
        width: variantWidth(request.pixels, meta.width, pictures.widths),
        attempt: 0,
      });
      return { resource, retain, meta };
    };
    for (const id of selected) {
      let pending = request.pending.get(id);
      if (!pending) {
        pending = read(id);
        request.pending.set(id, pending);
      }
      void pending.then((result) => {
        if (!active || current.current !== request) return;
        setLoaded((was) => {
          const previous = was?.scope === scope ? was : undefined;
          const signedOut = !!result.signedOut || !!previous?.signedOut;
          const files: Record<string, Picture> = {};
          if (!signedOut) {
            for (const file of selected)
              if (previous?.files[file]) files[file] = previous.files[file];
            const held = files[id];
            files[id] = {
              ...(held && (result.retain || held.metadata === result)
                ? held
                : {
                    resource: result.resource,
                    meta: result.meta ?? noMeta,
                    states: { [id]: result.resource ? "loading" : "error" },
                  }),
              metadata: result,
            };
          }
          return { scope, files, signedOut };
        });
      });
    }
    return () => {
      active = false;
    };
  }, [request, enabled, api, baseURL, identity?.userId, files, pictures, scope, selected]);
  const held = loaded?.scope === scope && enabled ? loaded : undefined;
  const onState = useCallback(
    (
      id: string,
      instance: string,
      resource: ImageResource,
      value: "loading" | "ready" | "error",
    ) => {
      if (current.current?.scope !== scope || !selected.includes(id)) return;
      setLoaded((was) => {
        const file = was?.scope === scope ? was.files[id] : undefined;
        if (!was || !file || file.resource !== resource || file.states[instance] === value)
          return was;
        return {
          ...was,
          files: {
            ...was.files,
            [id]: { ...file, states: { ...file.states, [instance]: value } },
          },
        };
      });
    },
    [scope, selected],
  );
  const renderImage = useCallback(
    (model: ImageSlotProps) => {
      const resource = selected.includes(model.id) ? held?.files[model.id]?.resource : undefined;
      return resource ? (
        <NativeImage
          key={JSON.stringify([resource.cacheKey, model.instance])}
          model={model}
          resource={resource}
          onState={(_id, state) => onState(model.id, model.instance ?? model.id, resource, state)}
        />
      ) : null;
    },
    [held, onState, selected],
  );
  const states: PictureStates = Object.assign({}, ...selected.map((id) => held?.files[id]?.states));
  const metas: Readonly<Record<string, FileMeta>> = Object.fromEntries(
    selected.map((id) => [id, held?.files[id]?.meta ?? noMeta]),
  );
  return { enabled, states, files: metas, renderImage };
}
