// Prepared by the capability's authorized read. Credentials never enter a UI model.
export interface ImageResource {
  readonly kind?: "uri";
  readonly scope: string;
  readonly id: string;
  readonly version: string;
  readonly uri: string;
  readonly cachePolicy?: "none" | "memory";
  readonly cacheKey?: string;
  readonly headers?: Readonly<Record<string, string>>;
}
/** SvgResource holds only the current authorized response; it is never cached or persisted. */
export interface SvgResource {
  readonly kind: "svg";
  readonly scope: string;
  readonly id: string;
  readonly version: string;
  readonly xml: string;
}
export type PictureResource = ImageResource | SvgResource;

export interface MapResource {
  readonly scope: string;
  readonly version: string;
  /** The product supplies its permitted style endpoint and attribution. */
  readonly styleURL: string;
}
