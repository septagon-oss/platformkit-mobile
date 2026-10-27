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
import { enrichmentFailure } from "../core/command";
import {
  fileMeta,
  noMeta,
  pictureId,
  composedReference,
  type FileMeta,
  type PictureStates,
} from "../core/present";
import { type ImageSlotProps } from "../core/media";
import { type Row } from "../core/record";
import { variantWidth } from "../core/prose";
import { fileResource } from "../effects/files";
import type { PictureResource } from "../effects/media";
import { useShell } from "../shell";
import { extent } from "../ui/scale";
import { NativeImage } from "./NativeImage";
import { failureFacts } from "./failure";

interface FileRead {
  readonly resource?: PictureResource | undefined;
  readonly retain?: boolean;
  readonly signedOut?: boolean;
  /** meta is what the read answered of the file itself: the frame it probed and the caption it holds. */
  readonly meta?: FileMeta | undefined;
}
interface Picture {
  readonly metadata: FileRead;
  readonly meta: FileMeta;
  readonly resource: PictureResource | undefined;
  readonly visit: object;
  readonly states: PictureStates;
}

/**
 * usePictures binds stored IDs and composed references to session-owned slots.
 * A changed attempt (0 by default) refreshes reads; only stored-file transient failures retain bytes.
 * Scope loss and composed refreshes withdraw old resources immediately; obsolete callbacks do nothing.
 * `width` defaults to the row-media extent and plans stored variants in device pixels.
 * `files` supplies stored metadata; composed pictures use the existing empty metadata.
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
  const wanted = [...new Set(ids.filter((id) => pictureId(id) || composedReference(id)))]
    .sort()
    .join(",");
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
      pending: new Map<string, { promise: Promise<FileRead>; stop: AbortController }>(),
      settled: new Set<string>(),
    }),
    [scope, attempt, viewport.scale, width],
  );
  const current = useRef<typeof request | undefined>(request);
  const [loaded, setLoaded] = useState<{
    scope: typeof scope;
    files: Readonly<Record<string, Picture>>;
    signedOut: boolean;
    selection: readonly string[];
    request: typeof request;
  }>();
  useLayoutEffect(() => {
    current.current = request;
    return () => {
      if (current.current === request) current.current = undefined;
      for (const pending of request.pending.values()) pending.stop.abort();
      request.pending.clear();
      request.settled.clear();
    };
  }, [request]);
  const enabled = !!pictures && !!identity?.userId && !!key && state.phase === "ready";
  if (
    loaded &&
    (!enabled ||
      loaded.scope !== scope ||
      loaded.selection !== selected ||
      loaded.request !== request)
  ) {
    setLoaded(
      enabled
        ? {
            scope,
            selection: selected,
            request,
            signedOut: loaded.scope === scope && loaded.signedOut,
            files:
              loaded.scope === scope
                ? Object.fromEntries(
                    Object.entries(loaded.files).filter(
                      ([id, picture]) =>
                        selected.includes(id) &&
                        (!composedReference(id) || picture.visit === request),
                    ),
                  )
                : {},
          }
        : undefined,
    );
  }
  useEffect(() => {
    if (!enabled || !pictures) {
      for (const pending of request.pending.values()) pending.stop.abort();
      request.pending.clear();
      request.settled.clear();
      return;
    }
    let active = true;
    for (const [id, pending] of request.pending) {
      if (!selected.includes(id)) {
        pending.stop.abort();
        request.pending.delete(id);
      }
    }
    for (const id of request.settled) if (!selected.includes(id)) request.settled.delete(id);
    const generation = JSON.stringify([scope.namespace, ++sequence.current]);
    const read = async (id: string, signal: AbortSignal): Promise<FileRead> => {
      if (composedReference(id)) {
        if (!pictures.composedSource) return {};
        try {
          const xml = await api.composedPicture(pictures.composedSource, id, { signal });
          return {
            resource: {
              kind: "svg",
              scope: JSON.stringify([
                baseURL,
                scope.user,
                scope.key,
                scope.namespace,
                pictures.composedSource,
              ]),
              id,
              version: generation,
              xml,
            },
          };
        } catch (error) {
          return enrichmentFailure(failureFacts(error)) === "signed-out" ? { signedOut: true } : {};
        }
      }
      if (!pictures.source) return {};
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
      if (request.settled.has(id)) continue;
      let pending = request.pending.get(id);
      if (!pending) {
        const stop = new AbortController();
        pending = { promise: read(id, stop.signal), stop };
        request.pending.set(id, pending);
      }
      void pending.promise.then((result) => {
        if (!active || current.current !== request) return;
        request.pending.delete(id);
        request.settled.add(id);
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
                    states:
                      result.resource?.kind === "svg"
                        ? {}
                        : { [id]: result.resource ? "loading" : "error" },
                  }),
              metadata: result,
              visit: request,
            };
          }
          return { scope, files, signedOut, selection: selected, request };
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
      resource: PictureResource,
      value: "loading" | "ready" | "error",
    ) => {
      if (
        current.current?.scope !== scope ||
        !selected.includes(id) ||
        (resource.kind === "svg" && current.current !== request)
      )
        return;
      setLoaded((was) => {
        const file = was?.scope === scope ? was.files[id] : undefined;
        if (!was || !file || file.resource !== resource || file.states[instance] === value)
          return was;
        const states = { ...file.states, [instance]: value };
        const discard =
          resource.kind === "svg" && Object.values(states).every((state) => state === "error");
        return {
          ...was,
          files: {
            ...was.files,
            [id]: { ...file, states, ...(discard ? { resource: undefined, metadata: {} } : {}) },
          },
        };
      });
    },
    [scope, selected, request],
  );
  const pictureFor = useCallback(
    (id: string) => {
      const picture = selected.includes(id) ? held?.files[id] : undefined;
      return composedReference(id) && picture?.visit !== request ? undefined : picture;
    },
    [held, selected, request],
  );
  const renderImage = useCallback(
    (model: ImageSlotProps) => {
      const picture = pictureFor(model.id);
      const resource = picture?.resource;
      if (resource?.kind === "svg" && picture?.states[model.instance ?? model.id] === "error")
        return null;
      return resource ? (
        <NativeImage
          key={JSON.stringify([
            resource.kind === "svg" ? resource.version : resource.cacheKey,
            model.instance,
          ])}
          model={model}
          resource={resource}
          onState={(_id, state) => onState(model.id, model.instance ?? model.id, resource, state)}
        />
      ) : null;
    },
    [pictureFor, onState],
  );
  const states: PictureStates = Object.assign({}, ...selected.map((id) => pictureFor(id)?.states));
  const metas: Readonly<Record<string, FileMeta>> = Object.fromEntries(
    selected.map((id) => [id, held?.files[id]?.meta ?? noMeta]),
  );
  return { enabled, states, files: metas, renderImage };
}
