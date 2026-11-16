import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { PHOTO_MAX_CHARS, PHOTO_PREFIX } from "@gigsync/protocol";

/**
 * A photo picked on the phone (camera or gallery), shrunk here before it goes anywhere (ADR 0066): drawn on a canvas
 * no longer than `SIDES[n]` pixels on its long side and saved as a JPEG, at falling quality and then smaller sizes,
 * until its data URL fits `PHOTO_MAX_CHARS`. The original never leaves the phone; neither do its location tags, which
 * a canvas does not copy.
 */

/** Long sides tried, in pixels: sharp enough to see a crack or a stain, small enough for the encrypted request. */
const SIDES = [960, 720, 560, 420] as const;
/** JPEG qualities tried at each size. */
const QUALITIES = [0.72, 0.58, 0.45] as const;
const JPEG = "image/jpeg";

/** No size or quality made the photo small enough, or the file is not a picture the phone can draw. */
export class PhotoError extends Error {}

/** The words of the phone's own picker sheet, in the owner's language. */
export interface PickerWords {
  title: string;
  camera: string;
  gallery: string;
  cancel: string;
}

/** The largest side the picker hands over, in pixels: the shrinking below makes it smaller still. */
const PICK_SIDE = 1600;

/** Whether the phone's own picker is there (the Android and iOS apps); the web uses a file input instead. */
export const nativePicker = (): boolean => Capacitor.isNativePlatform();

/**
 * The phone's own sheet, "Take photo" or "Choose from gallery", as WhatsApp and ChatGPT open it, and the picture
 * picked; undefined when the owner closed the sheet without one.
 */
export async function pickPhoto(words: PickerWords): Promise<Blob | undefined> {
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Prompt,
      resultType: CameraResultType.Uri,
      width: PICK_SIDE,
      height: PICK_SIDE,
      correctOrientation: true,
      saveToGallery: false,
      promptLabelHeader: words.title,
      promptLabelPhoto: words.gallery,
      promptLabelPicture: words.camera,
      promptLabelCancel: words.cancel,
    });
    if (!photo.webPath) return undefined;
    return await (await fetch(photo.webPath)).blob();
  } catch {
    // Closing the sheet rejects too; nothing was picked either way.
    return undefined;
  }
}

async function bitmapOf(file: Blob): Promise<ImageBitmap> {
  try {
    // Turned upright as the camera meant it: a phone photo's rotation is in its tags, which the canvas drops.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError("not a picture");
  }
}

function drawn(bitmap: ImageBitmap, side: number): HTMLCanvasElement {
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** The picked file as a JPEG data URL small enough for a request. */
export async function shrinkPhoto(file: Blob): Promise<string> {
  const bitmap = await bitmapOf(file);
  try {
    for (const side of SIDES) {
      const canvas = drawn(bitmap, side);
      for (const quality of QUALITIES) {
        const url = canvas.toDataURL(JPEG, quality);
        if (url.startsWith(PHOTO_PREFIX) && url.length <= PHOTO_MAX_CHARS) return url;
      }
    }
  } finally {
    bitmap.close();
  }
  throw new PhotoError("too big");
}
