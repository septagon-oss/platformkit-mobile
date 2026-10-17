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
  pictureId,
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
  readonly resource?: ImageResource | undefined;
  readonly retain?: boolean;
  readonly signedOut?: boolean;
}
interface Picture {
  readonly resource: ImageResource | undefined;
  readonly states: PictureStates;
}

/**
 * usePictures binds session-owned bytes to decorative slots, coalescing metadata per file and attempt.
 * A changed attempt (0 by default) refreshes metadata while retaining the same session's resources;
 * transient failures retain them, explicit refusals withdraw them, and scope changes discard them.
 */
export function usePictures(ids: readonly string[], attempt: unknown = 0) {
  const { api, baseURL, identity, state, entry } = useShell();
  const mount = useId();
  const viewport = useWindowDimensions();
  const key = api.bearer();
  const pictures = state.catalog?.pictures;
  const wanted = [...new Set(ids.filter(pictureId))].sort().join(",");
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
      pixels: extent.rowMedia * viewport.scale,
      pending: new Map<string, Promise<FileRead>>(),
    }),
    [scope, attempt, viewport.scale],
  );
  const current = useRef<typeof request | undefined>(request);
  const [loaded, setLoaded] = useState<{
    request: typeof request;
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
    void (async () => {
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
          width: variantWidth(
            request.pixels,
            typeof row?.width === "number" ? row.width : 0,
            pictures.widths,
          ),
          attempt: 0,
        });
        return { resource, retain };
      };
      const results = await Promise.all(
        wanted
          .split(",")
          .filter(Boolean)
          .map(async (id) => {
            let pending = request.pending.get(id);
            if (!pending) {
              pending = read(id);
              request.pending.set(id, pending);
            }
            return [id, await pending] as const;
          }),
      );
      if (!active || current.current !== request) return;
      setLoaded((was) => {
        const previous = was?.request.scope === scope ? was : undefined;
        const signedOut = results.some(([, result]) => result.signedOut) || !!previous?.signedOut;
        const files: Record<string, Picture> = {};
        if (!signedOut)
          for (const [id, result] of results) {
            const held = previous?.files[id];
            files[id] =
              held && (result.retain || was?.request === request)
                ? held
                : {
                    resource: result.resource,
                    states: { [id]: result.resource ? "loading" : "error" },
                  };
          }
        return { request, files, signedOut };
      });
    })();
    return () => {
      active = false;
    };
  }, [request, enabled, api, baseURL, identity?.userId, files, pictures, scope, wanted]);
  const held = loaded?.request.scope === scope && enabled ? loaded : undefined;
  const onState = useCallback(
    (
      id: string,
      instance: string,
      resource: ImageResource,
      value: "loading" | "ready" | "error",
    ) => {
      if (current.current?.scope !== scope) return;
      setLoaded((was) => {
        const file = was?.request.scope === scope ? was.files[id] : undefined;
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
    [scope],
  );
  const renderImage = useCallback(
    (model: ImageSlotProps) => {
      const resource = held?.files[model.id]?.resource;
      return resource ? (
        <NativeImage
          key={JSON.stringify([resource.cacheKey, model.instance])}
          model={model}
          resource={resource}
          onState={(_id, state) => onState(model.id, model.instance ?? model.id, resource, state)}
        />
      ) : null;
    },
    [held, onState],
  );
  const states: PictureStates = Object.assign(
    {},
    ...wanted.split(",").map((id) => held?.files[id]?.states),
  );
  return { enabled, states, renderImage };
}
