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
import { pictureId, type ImageSlotProps, type PictureStates, type Row } from "../core/derive";
import { variantWidth } from "../core/prose";
import { ApiError } from "../effects/api";
import { fileResource } from "../effects/files";
import type { ImageResource } from "../effects/media";
import { useShell } from "../shell";
import { extent } from "../ui/scale";
import { NativeImage } from "./NativeImage";

/** usePictures reads metadata once per visible file and binds session-owned bytes to decorative slots. */
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
      pending: new Map<string, Promise<ImageResource | undefined>>(),
    }),
    [scope, attempt, viewport.scale],
  );
  const current = useRef<typeof request | undefined>(request);
  const [loaded, setLoaded] = useState<{
    request: typeof request;
    resources: Readonly<Record<string, ImageResource>>;
    states: PictureStates;
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
      const read = async (id: string): Promise<ImageResource | undefined> => {
        let row: Row | undefined;
        if (files && offers(files, "read")) {
          try {
            row = await api.get(files, id);
          } catch (e) {
            if (e instanceof ApiError && [401, 403, 404].includes(e.status)) return undefined;
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
        return resource;
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
      const resources: Record<string, ImageResource> = {},
        states: Record<string, "loading" | "error"> = {};
      for (const [id, resource] of results) {
        if (resource) resources[id] = resource;
        states[id] = resource ? "loading" : "error";
      }
      setLoaded((was) => ({
        request,
        resources,
        states: { ...states, ...(was?.request === request ? was.states : {}) },
      }));
    })();
    return () => {
      active = false;
    };
  }, [request, enabled, api, baseURL, identity?.userId, files, pictures, scope.namespace, wanted]);
  const held = loaded?.request === request && enabled ? loaded : undefined;
  const onState = useCallback(
    (id: string, value: "loading" | "ready" | "error") => {
      if (current.current !== request) return;
      setLoaded((was) =>
        !was || was.request !== request || was.states[id] === value
          ? was
          : { ...was, states: { ...was.states, [id]: value } },
      );
    },
    [request],
  );
  const renderImage = useCallback(
    (model: ImageSlotProps) => {
      const resource = held?.resources[model.id];
      return resource ? (
        <NativeImage
          key={JSON.stringify([resource.cacheKey, model.instance])}
          model={model}
          resource={resource}
          onState={(_id, state) => onState(model.instance ?? model.id, state)}
        />
      ) : null;
    },
    [held, onState],
  );
  return { enabled, states: held?.states ?? {}, renderImage };
}
