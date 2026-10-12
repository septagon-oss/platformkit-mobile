// RichTextBody is one rich text field of a record, read rather than printed: the runs of
// the body drawn in the kit's type, the figures drawn from the bytes this session may
// read, and each figure's box reserved by the frame the server measured. It is a screen
// adapter because that is where a request becomes a prop — the body's own segmentation
// names the files it points at, each file's row names the frame, and the authenticated
// read of the pin's content address says when a picture is on the screen.
//
// A figure whose file this phone cannot read stops the native reading of the whole body:
// the field draws the caller's value shape instead, so the person reads the whole body as
// text rather than a native body with a figure missing from it. Reserving a box for a
// frame nobody measured, or painting a picture over a caption that is not its own, would
// both be the phone inventing what the server never said.
import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { key } from "../core/catalog";
import type { Presentation, Row } from "../core/derive";
import type { MediaItem } from "../core/media";
import { deriveProse, proseBlocks, type ProseFigure } from "../core/prose";
import { rowAddress } from "../effects/api";
import { fileResource } from "../effects/files";
import { answered } from "../effects/read-cache";
import { useShell } from "../shell";
import { Prose } from "../ui/organisms/Prose";
import { MarkdownProse } from "./MarkdownProse";
import { NativeImage } from "./NativeImage";

interface Props {
  readonly presentation: Presentation;
  /** source is the body exactly as the server stored it. */
  readonly source: string;
  /** testID names the reader and, through it, every block and figure it draws. */
  readonly testID: string;
  /**
   * fallback is the value in the shape its type deserves, drawn whenever this body cannot
   * be read whole: the whole body as text, rather than a native body with a figure, a
   * fence or a construct missing from it.
   */
  readonly fallback: ReactNode;
}

/** Frame is what a file's own row says of its picture: the frame to reserve and the content version to key a read on. */
interface Frame {
  readonly width: number;
  readonly height: number;
  readonly version: string;
}

/**
 * figuresIn lists a body's figures in the order they appear, because the files to read
 * are known before the model is built. A body the segmentation refuses has none to read
 * for: it is drawn as prose by the caller, figures and all.
 */
function figuresIn(source: string): readonly ProseFigure[] {
  const split = proseBlocks(source);
  return split.ok ? split.blocks.filter((b): b is ProseFigure => b.kind === "figure") : [];
}

/** frameOf is the measured frame a File row carries, or nothing when it named none. A picture with no measurements reserves nothing. */
function frameOf(row: Row): Frame | null {
  const width = row.width,
    height = row.height;
  if (
    typeof width !== "number" ||
    !Number.isSafeInteger(width) ||
    width <= 0 ||
    typeof height !== "number" ||
    !Number.isSafeInteger(height) ||
    height <= 0
  )
    return null;
  return {
    width,
    height,
    version: typeof row.sha256 === "string" ? row.sha256 : "",
  };
}

/**
 * RichTextBody reads one field's body natively, or draws the caller's fallback where the
 * body cannot be read whole (src/core/prose.ts's refusal, a figure whose file this phone
 * cannot read).
 */
export function RichTextBody({ presentation, source, testID, fallback }: Props) {
  const { api, entry, reads, baseURL, identity } = useShell();
  const figures = useMemo(() => figuresIn(source), [source]);
  const wanted = useMemo(() => figures.map((figure) => figure.file).join(","), [figures]);
  // The file module as this server's catalogue names it. Absent means there is nothing
  // to ask, which is said as an unavailable figure rather than a wait that never ends.
  const files = entry("file", "files");
  // Each file's row: undefined while it is arriving, null when it cannot be read.
  const [rows, setRows] = useState<Record<string, Frame | null>>({});
  // Which figures have had their bytes painted, straight from the loader.
  const [painted, setPainted] = useState<Record<string, MediaItem["state"]>>({});
  // How often this phone has asked for each file, and for the whole set again.
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [again, setAgain] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const ids = wanted === "" ? [] : wanted.split(",");
    if (ids.length === 0 || files === undefined) return;
    const started = ++generation.current;
    void (async () => {
      for (const id of ids) {
        try {
          // The same read every other row on this screen goes through, cache included:
          // a picture's measurements are a row like any other.
          const got = await answered(
            reads,
            { kind: "row", resourceKey: key(files), path: rowAddress(files, id) },
            "",
            () => api.get(files, id),
          );
          if (generation.current !== started) return;
          setRows((held) => ({ ...held, [id]: frameOf(got.value) }));
        } catch {
          if (generation.current !== started) return;
          setRows((held) => ({ ...held, [id]: null }));
        }
      }
    })();
  }, [wanted, files, api, reads, again]);

  const report = useCallback((id: string, state: "loading" | "ready" | "error") => {
    setPainted((held) => (held[id] === state ? held : { ...held, [id]: state }));
  }, []);

  /** retry asks once more for one figure: its row where no row was read, its bytes where they did not arrive. */
  const retry = useCallback(
    (figureId: string) => {
      const file = figures.find((figure) => figure.id === figureId)?.file;
      if (file === undefined) return;
      setPainted((held) => ({ ...held, [file]: "loading" }));
      setAttempts((held) => ({ ...held, [file]: (held[file] ?? 0) + 1 }));
      setAgain((asked) => asked + 1);
    },
    [figures],
  );

  const items = useMemo(() => {
    const out: Record<string, MediaItem> = {};
    for (const figure of figures) {
      // Nothing to ask: this server's catalogue names no file module, so no figure can
      // have its frame measured or its bytes read. Said as an unavailable figure — which
      // stops the native reading of the whole body — rather than a wait that never ends.
      if (files === undefined) {
        out[figure.id] = {
          id: figure.file,
          width: 0,
          height: 0,
          description: figure.alt,
          decorative: figure.alt === "",
          state: "unavailable",
        };
        continue;
      }
      const frame = rows[figure.file];
      // Its row has not been read yet: the figure says it is arriving and reserves no box.
      if (frame === undefined) continue;
      out[figure.id] = {
        id: figure.file,
        width: frame?.width ?? 0,
        height: frame?.height ?? 0,
        // The author's own words for the picture — the file's upload name is nobody's caption.
        description: figure.alt,
        decorative: figure.alt === "",
        state: frame === null ? "unavailable" : (painted[figure.file] ?? "loading"),
      };
    }
    return out;
  }, [figures, rows, painted, files]);

  const model = deriveProse({ source, figures: items }, presentation);
  if (!model.ok) return <>{fallback}</>;

  return (
    <Prose
      model={model.value}
      testID={testID}
      renderMarkdown={(text) => <MarkdownProse source={text} />}
      renderFigure={(figure) => {
        const file = figures.find((one) => one.id === figure.id)?.file;
        const slot = figure.slot;
        if (file === undefined || slot === undefined) return null;
        const resource = fileResource({
          server: baseURL,
          userId: identity?.userId,
          entry: files,
          id: file,
          version: rows[file]?.version ?? "",
          attempt: attempts[file] ?? 0,
          cookie: api.cookie(),
        });
        if (resource === undefined) return null;
        return <NativeImage model={slot} resource={resource} onState={report} />;
      }}
      onRetryFigure={retry}
    />
  );
}
