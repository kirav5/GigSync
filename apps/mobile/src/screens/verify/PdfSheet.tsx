import type { MessageKey } from "@gigsync/core";
import { useState } from "react";
import { PdfProblem, readQrInPdf } from "../../adapters/aadhaarPdf.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { Sheet } from "../../ui/Sheet.js";

/** The PDF myAadhaar gives; the MIME type too, since Android's file picker ignores a bare extension. */
const PDF_FILES = ".pdf,application/pdf";
/** The password is the person's own: no autofill or corrections, but capitals as typed. */
const OFF = "off";
const CHARACTERS = "characters";
const PROBLEM: Readonly<Record<PdfProblem, MessageKey>> = {
  [PdfProblem.password]: "idcheck.pdf_wrong_password",
  [PdfProblem.not_pdf]: "idcheck.pdf_not_pdf",
  [PdfProblem.no_qr]: "idcheck.pdf_no_qr",
};

/**
 * The e-Aadhaar PDF from myAadhaar (Download Aadhaar, with an OTP): pick it, type its password, and the phone reads
 * the big Secure QR on its first page (adapters/aadhaarPdf.ts). The QR's text goes on to the same check as a scanned
 * card; the file and the password live in this sheet's memory only, for the length of the read.
 */
export function PdfSheet({ onQr, onClose }: { onQr: (qrText: string) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [file, setFile] = useState<File>();
  const [password, setPassword] = useState("");
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<MessageKey>();

  async function read(chosen: File) {
    setProblem(undefined);
    setReading(true);
    // Anything pdf.js did not expect reads as "not an e-Aadhaar PDF", never a sheet stuck on Checking.
    const found = await readQrInPdf(chosen, password).catch(() => undefined);
    setReading(false);
    if (found?.ok) return onQr(found.text);
    setProblem(PROBLEM[found?.problem ?? PdfProblem.not_pdf]);
  }

  return (
    <Sheet title={t("idcheck.pdf_title")} line={t("idcheck.pdf_line")} icon="doc" onClose={onClose}>
      <form
        className={`${C.stack} verify-ekyc`}
        onSubmit={(e) => {
          e.preventDefault();
          if (file) void read(file);
        }}
      >
        <label className={`${C.secondary} verify-gallery`}>
          <Icon name="doc" size={20} />
          {file ? t("idcheck.ekyc_file_chosen", { name: file.name }) : t("idcheck.pdf_file")}
          <input
            type="file"
            accept={PDF_FILES}
            hidden
            onChange={(e) => {
              setFile(e.currentTarget.files?.[0]);
              setProblem(undefined);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("idcheck.pdf_password")}</span>
          <input
            className={C.field}
            name="pdf-password"
            type="password"
            value={password}
            autoComplete={OFF}
            autoCapitalize={CHARACTERS}
            autoCorrect={OFF}
            spellCheck={false}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <span className={C.faint}>{t("idcheck.pdf_password_hint")}</span>
        </label>
        {problem && (
          <p className={C.error} role="alert">
            {t(problem)}
          </p>
        )}
        <button
          type={C.submit}
          className={`${C.wide} btn-big`}
          disabled={!file || !password || reading}
          aria-busy={reading}
        >
          {reading ? t("idcheck.checking") : t("idcheck.ekyc_check")}
        </button>
        <button type={C.button} className={C.secondary} onClick={onClose}>
          {t("idcheck.later")}
        </button>
      </form>
    </Sheet>
  );
}
