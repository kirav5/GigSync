import { useEffect } from "react";
import { useI18n } from "../i18n.js";
import "./toast.css";

/** How long the line stays before it goes by itself. */
const TOAST_MS = 10_000;

/** One line, once: using GigSync is agreeing to its Terms and Privacy Notice, which Settings has. It goes by itself. */
export function ConsentToast({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const timer = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <p className="toast" role="status">
      {t("records.consent_toast")}
    </p>
  );
}
