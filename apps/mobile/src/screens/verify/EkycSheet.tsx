import { checkAadhaarEkyc, type Genuine, MAX_SHARE_CODE_LENGTH, type MessageKey } from "@gigsync/core";
import { useState } from "react";
import { idCheckOptions, readEkycFile } from "../../adapters/idcheck.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { Sheet } from "../../ui/Sheet.js";
import { EKYC_PROBLEM } from "./problems.js";

/** UIDAI's own page where a person downloads their Paperless Offline e-KYC ZIP with an OTP. */
const MYAADHAAR_OFFLINE_EKYC = "https://myaadhaar.uidai.gov.in/offline-ekyc";
/** The ZIP myAadhaar gives; the MIME types too, since Android's file picker ignores a bare extension. */
const ZIP_FILES = ".zip,application/zip,application/x-zip-compressed";
const NEW_TAB = "_blank";
/** The share code is case-sensitive and private: no autofill, capitals or corrections. */
const OFF = "off";
const NOT_FILE: MessageKey = "idcheck.ekyc_not_file";

/**
 * The quieter way to get verified, for someone whose Aadhaar card is not to hand: UIDAI's Paperless Offline e-KYC.
 * They download their ZIP from myAadhaar (an OTP to their Aadhaar mobile, a share code they set), pick it here and
 * type the share code; the phone checks UIDAI's signature (core/identity) and the screen goes on to the same "is this
 * you?" as the QR. The file and the code stay in this sheet's memory only, for the length of the check.
 */
export function EkycSheet({
  phone,
  onChecked,
  onClose,
}: {
  /** The signed-in number, which the file's mobile hash is checked against. */
  phone: string;
  onChecked: (found: Genuine) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [file, setFile] = useState<File>();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<MessageKey>();

  async function check(chosen: File) {
    setProblem(undefined);
    setChecking(true);
    const zip = await readEkycFile(chosen).catch(() => undefined);
    // Anything the check did not expect reads as "not an e-KYC file", never a sheet stuck on Checking.
    const result = zip ? await checkAadhaarEkyc(zip, code, idCheckOptions(phone)).catch(() => undefined) : undefined;
    zip?.fill(0);
    setChecking(false);
    if (result?.ok) return onChecked(result);
    setProblem(result ? EKYC_PROBLEM[result.problem] : NOT_FILE);
  }

  return (
    <Sheet title={t("idcheck.ekyc_title")} line={t("idcheck.ekyc_line")} icon="shield" onClose={onClose}>
      <form
        className={`${C.stack} verify-ekyc`}
        onSubmit={(e) => {
          e.preventDefault();
          if (file) void check(file);
        }}
      >
        <ol className="verify-ekyc-steps">
          <li>{t("idcheck.ekyc_step1")}</li>
          <li>{t("idcheck.ekyc_step2")}</li>
          <li>{t("idcheck.ekyc_step3")}</li>
        </ol>
        <a className={C.secondary} href={MYAADHAAR_OFFLINE_EKYC} target={NEW_TAB} rel="noopener noreferrer">
          {t("idcheck.ekyc_open")}
        </a>
        <label className={`${C.secondary} verify-gallery`}>
          <Icon name="doc" size={20} />
          {file ? t("idcheck.ekyc_file_chosen", { name: file.name }) : t("idcheck.ekyc_file")}
          <input
            type="file"
            accept={ZIP_FILES}
            hidden
            onChange={(e) => {
              setFile(e.currentTarget.files?.[0]);
              setProblem(undefined);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("idcheck.ekyc_code")}</span>
          <input
            className={C.field}
            name="share-code"
            value={code}
            maxLength={MAX_SHARE_CODE_LENGTH}
            autoComplete={OFF}
            autoCapitalize={OFF}
            autoCorrect={OFF}
            spellCheck={false}
            onChange={(e) => setCode(e.currentTarget.value)}
          />
          <span className={C.faint}>{t("idcheck.ekyc_code_hint")}</span>
        </label>
        {problem && (
          <p className={C.error} role="alert">
            {t(problem)}
          </p>
        )}
        <button
          type={C.submit}
          className={`${C.wide} btn-big`}
          disabled={!file || !code || checking}
          aria-busy={checking}
        >
          {checking ? t("idcheck.checking") : t("idcheck.ekyc_check")}
        </button>
        <button type={C.button} className={C.secondary} onClick={onClose}>
          {t("idcheck.later")}
        </button>
      </form>
    </Sheet>
  );
}
