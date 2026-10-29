import { log } from "@gigsync/core";
import { useEffect, useRef } from "react";
import { CameraError, CameraProblem, closeCamera, openCamera, qrReader } from "../adapters/camera.js";

/** How often a frame is read for a code. */
const SCAN_MS = 250;

/**
 * The camera's picture, read for a QR code until one is found: `onRead` gets its text once, and the camera is let go.
 * `onProblem` says why the camera did not open. Leaving the screen lets the camera go too.
 */
export function QrScanner({
  label,
  onRead,
  onProblem,
}: {
  label: string;
  onRead: (text: string) => void;
  onProblem: (p: CameraProblem) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  // The latest callbacks, so a parent re-render never reopens the camera.
  const read = useRef(onRead);
  const problem = useRef(onProblem);
  read.current = onRead;
  problem.current = onProblem;

  useEffect(() => {
    let live = true;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      live = false;
      clearTimeout(timer);
      if (stream) closeCamera(stream);
    };
    void (async () => {
      try {
        const [opened, reader] = await Promise.all([openCamera(), qrReader()]);
        stream = opened;
        const el = video.current;
        if (!live || !el) return stop();
        el.srcObject = opened;
        await el.play();
        const scan = async () => {
          if (!live) return;
          const text = await reader(el).catch(() => undefined);
          if (!live) return;
          if (text) {
            stop();
            read.current(text);
            return;
          }
          timer = setTimeout(() => void scan(), SCAN_MS);
        };
        void scan();
      } catch (err) {
        if (!live) return;
        stop();
        if (!(err instanceof CameraError)) log.warn("camera failed", { error: err instanceof Error ? err.name : "" });
        problem.current(err instanceof CameraError ? err.problem : CameraProblem.none);
      }
    })();
    return stop;
  }, []);

  return <video ref={video} className="qr-scanner" aria-label={label} muted playsInline />;
}
