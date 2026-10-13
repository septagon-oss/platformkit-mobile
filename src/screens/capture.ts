// capture.ts is the phone's own camera and photo library as one question: it takes the
// answer and hands back the picture this app was given, so that the body a person is
// writing can point at it. Nothing here knows about records, Markdown or the file module:
// a picture that this app could not be given is answered with nothing, and the caller who
// owns the body decides what to say about that. Where the platform itself refuses the
// question — a permission this installation was denied, a camera it has no use for — the
// answer says so, because a silent no would look like a person who changed their mind.
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
} from "expo-image-picker";

/** Capture is where a picture comes from: the camera in this hand, or the library on the phone. */
export type Capture = "camera" | "library";

/** Picture is one image this app was handed: bytes at a temporary address, and a name. */
export interface Picture {
  readonly uri: string;
  readonly name: string;
  readonly mime: string;
}

/** CaptureAnswer is what the phone said: a picture, or that there is none and why. */
export interface CaptureAnswer {
  readonly picture: Picture | undefined;
  /** refused says the platform would not let this app ask — not that nobody answered. */
  readonly refused: boolean;
}

const NONE: CaptureAnswer = { picture: undefined, refused: false };

/**
 * capturePicture asks for one image, in the way chosen: the camera for a picture taken now,
 * the library for one already on the phone. A quality of 1 keeps the frame as the phone
 * took it — this is a person's evidence, not a thumbnail — and the first asset is the one
 * they picked. A person who backs out, and a platform that will not grant the camera or the
 * library, both answer with no picture; only the second one is said to be a refusal.
 */
export async function capturePicture(via: Capture): Promise<CaptureAnswer> {
  const allowed =
    via === "camera"
      ? await requestCameraPermissionsAsync()
      : await requestMediaLibraryPermissionsAsync();
  if (!allowed.granted) return { picture: undefined, refused: true };
  const answer =
    via === "camera"
      ? await launchCameraAsync({ quality: 1, exif: false })
      : await launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  const asset = answer.canceled ? undefined : answer.assets[0];
  if (asset === undefined) return NONE;
  return {
    picture: {
      uri: asset.uri,
      name: asset.fileName ?? (via === "camera" ? "photo.jpg" : "picture.jpg"),
      mime: asset.mimeType ?? "image/jpeg",
    },
    refused: false,
  };
}

/**
 * uploadForm is the multipart body a file upload takes: one part, carrying the bytes under
 * the name and media type the phone gave them. The file module reads the first part that
 * names a file and asks nothing else of a form — everything else an upload declares is a
 * query parameter on its address — so this carries exactly the one part and no field.
 */
export function uploadForm(picture: Picture): FormData {
  const form = new FormData();
  // React Native's FormData takes a file described by its address on the phone rather than
  // a Blob: the bytes never come into JavaScript, and the transport streams them.
  form.append("file", {
    uri: picture.uri,
    name: picture.name,
    type: picture.mime,
  } as unknown as string);
  return form;
}
