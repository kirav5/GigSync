import { type ReactNode, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/**
 * "Cancel this job", which asks once more before it acts: a signed job is called off for both sides, so a slip of the
 * thumb must not do it. `children` are the moves shown beside it while the owner has not asked to cancel.
 */
export function CancelJob({ onCancel, children }: { onCancel: () => void; children?: ReactNode }) {
  const { t } = useI18n();
  const [sure, setSure] = useState(false);
  if (sure)
    return (
      <fieldset className={C.actions} aria-label={t("restored.cancel_sure")}>
        <span>{t("restored.cancel_sure")}</span>
        <button type={C.button} className={C.danger} onClick={onCancel}>
          {t("restored.cancel_yes")}
        </button>
        <button type={C.button} className={C.secondary} onClick={() => setSure(false)}>
          {t("restored.keep")}
        </button>
      </fieldset>
    );
  return (
    <div className={C.actions}>
      {children}
      <button type={C.button} className={C.quiet} onClick={() => setSure(true)}>
        {t("restored.cancel")}
      </button>
    </div>
  );
}
