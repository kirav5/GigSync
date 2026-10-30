/**
 * DEV ONLY: a scripted QR scan for the UI tests, which have no camera to point at another phone. When
 * localStorage["gigsync-fake-scan"] holds a text, the next scan reads it at once, without opening the camera, and the
 * text is forgotten. QrScanner calls this only under import.meta.env.DEV, so release builds always use the camera.
 */
const FAKE_SCAN_KEY = "gigsync-fake-scan";

export function takeFakeScan(): string | undefined {
  try {
    const text = localStorage.getItem(FAKE_SCAN_KEY);
    if (text === null) return undefined;
    localStorage.removeItem(FAKE_SCAN_KEY);
    return text;
  } catch {
    return undefined;
  }
}
