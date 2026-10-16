// expo-image as a screen sees it: a component that records the request it was handed and
// paints nothing. Nothing here reaches a byte, and a test reads what was asked for.
import type { ImageResource } from "../../src/effects/media";

/** Asked is one image request: the address, the headers it carried, and whose picture it is. */
export interface Asked {
  readonly uri: string;
  readonly headers: Readonly<Record<string, string>> | undefined;
  readonly label: string | undefined;
}

export const asked: Asked[] = [];

export function resetAsked(): void {
  asked.length = 0;
  nativeRequests.length = 0;
}

/** ExpoImage stands in for the native view: it records the prepared resource and renders nothing. */
export function ExpoImage(props: {
  readonly source:
    ImageResource | { readonly uri: string; readonly headers?: Record<string, string> };
  readonly accessibilityLabel?: string;
  readonly [key: string]: unknown;
}) {
  nativeRequests.push(props as unknown as NativeRequest);
  asked.push({
    uri: props.source.uri,
    headers: props.source.headers,
    label: props.accessibilityLabel,
  });
  return null;
}

export interface NativeRequest {
  readonly source: {
    readonly uri: string;
    readonly cacheKey?: string;
    readonly headers?: Readonly<Record<string, string>>;
  };
  readonly cachePolicy: unknown;
  readonly recyclingKey: unknown;
  readonly transition: unknown;
  readonly onLoadStart: () => void;
  readonly onLoad: () => void;
  readonly onError: () => void;
}
export const nativeRequests: NativeRequest[] = [];
