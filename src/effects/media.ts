// Prepared by the capability's authorized read. Credentials never enter a UI model.
export interface ImageResource {
  readonly scope: string;
  readonly id: string;
  readonly version: string;
  readonly uri: string;
  readonly headers?: Readonly<Record<string, string>>;
}
export interface MapResource {
  readonly scope: string;
  readonly version: string;
  /** The product supplies its permitted style endpoint and attribution. */
  readonly styleURL: string;
}
