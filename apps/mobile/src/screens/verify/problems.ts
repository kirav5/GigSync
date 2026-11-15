import { IdCheckProblem, type MessageKey } from "@gigsync/core";
import { CameraProblem } from "../../adapters/camera.js";

/**
 * Each refusal's line, with `notIt` for anything that is not a signed Aadhaar of this kind ("not an Aadhaar QR" for a
 * scan or a PDF, "not an e-KYC file" for a ZIP).
 */
function problemLines(
  notIt: MessageKey,
  lines: Partial<Record<IdCheckProblem, MessageKey>>,
): Readonly<Record<IdCheckProblem, MessageKey>> {
  const all = Object.fromEntries(Object.values(IdCheckProblem).map((p) => [p, notIt])) as Record<
    IdCheckProblem,
    MessageKey
  >;
  return { ...all, [IdCheckProblem.no_uidai_key]: "idcheck.unavailable", ...lines };
}

/** A scanned card, a photo or a PDF: anything that is not a signed Aadhaar QR reads as "not an Aadhaar QR". */
export const QR_PROBLEM = problemLines("idcheck.not_aadhaar", {
  [IdCheckProblem.signature_mismatch]: "idcheck.bad_signature",
});

/** An e-KYC ZIP: anything that is not UIDAI's signed e-KYC file reads as "not an e-KYC file". */
export const EKYC_PROBLEM = problemLines("idcheck.ekyc_not_file", {
  [IdCheckProblem.wrong_share_code]: "idcheck.ekyc_wrong_code",
  [IdCheckProblem.signature_mismatch]: "idcheck.ekyc_bad_signature",
});

export const CAMERA: Readonly<Record<CameraProblem, MessageKey>> = {
  [CameraProblem.denied]: "qr.camera_denied",
  [CameraProblem.none]: "qr.no_camera",
};
