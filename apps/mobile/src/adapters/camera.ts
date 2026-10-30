/** Why the camera did not open: the owner (or the phone's settings) said no, or there is no camera to use. */
export const CameraProblem = { denied: "denied", none: "none" } as const;
export type CameraProblem = (typeof CameraProblem)[keyof typeof CameraProblem];

export class CameraError extends Error {
  constructor(readonly problem: CameraProblem) {
    super(`camera ${problem}`);
  }
}

/** getUserMedia's refusals (DOMException names) that mean "not allowed"; every other failure means no usable camera. */
const REFUSED: ReadonlySet<string> = new Set(["NotAllowedError", "SecurityError"]);
/** The camera on the back of a phone; a laptop's only camera is used when it has no such thing. */
const BACK_CAMERA = "environment";
const QR_FORMAT = "qr_code";
/** jsQR reads a frame at most this wide: enough for a code at arm's length, small enough to read 4 times a second. */
const MAX_FRAME_PX = 640;

/**
 * Opens the camera for scanning, as a stream for a `<video>`. On a native phone the web view asks the phone's own
 * permission first (Android: Capacitor's WebChromeClient, which needs CAMERA in the manifest; iPhone: the camera usage
 * text in Info.plist). Throws CameraError.
 */
export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError(CameraProblem.none);
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: BACK_CAMERA } }, audio: false });
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    throw new CameraError(REFUSED.has(name) ? CameraProblem.denied : CameraProblem.none);
  }
}

/** Lets the camera go, so its light turns off. */
export function closeCamera(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

/** The browser's own barcode reader where it has one (Chrome on Android, macOS); not in TypeScript's DOM types yet. */
interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
interface DetectorClass {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
}

/** Reads the text of a QR code in the video's current frame, or undefined when there is none yet. */
export type QrReader = (video: HTMLVideoElement) => Promise<string | undefined>;

/** The phone's own QR reader when it has one, else jsQR (loaded only then) on a downscaled copy of the frame. */
export async function qrReader(): Promise<QrReader> {
  const native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (native && (await native.getSupportedFormats()).includes(QR_FORMAT)) {
    const detector = new native({ formats: [QR_FORMAT] });
    return async (video) => (await detector.detect(video))[0]?.rawValue;
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!context || video.videoWidth === 0) return undefined;
    const scale = Math.min(1, MAX_FRAME_PX / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(frame.data, frame.width, frame.height)?.data;
  };
}
