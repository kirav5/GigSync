import type { MessageKey } from "@gigsync/core";
import { useEffect, useState } from "react";
import { CameraProblem } from "../../adapters/camera.js";
import { needsExplaining, Permission } from "../../adapters/permissions.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { PermissionSheet } from "../../ui/PermissionSheet.js";
import { QrScanner } from "../../ui/QrScanner.js";

const CAMERA: Readonly<Record<CameraProblem, MessageKey>> = {
  [CameraProblem.denied]: "phone.camera_denied",
  [CameraProblem.none]: "phone.no_camera",
};

/**
 * The camera, asked for only now that the owner tapped Scan (on a native phone, after saying why in their language),
 * reading the old phone's move code. `onText` gets the first QR text it reads, `onProblem` why the camera did not
 * open, and `onClose` a no to the camera.
 */
export function MoveScan({
  onText,
  onProblem,
  onClose,
}: {
  onText: (text: string) => void;
  onProblem: (why: MessageKey) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [explain, setExplain] = useState<boolean>();

  useEffect(() => {
    let live = true;
    void needsExplaining(Permission.camera)
      .catch(() => false)
      .then((needed) => {
        if (live) setExplain(needed);
      });
    return () => {
      live = false;
    };
  }, []);

  if (explain === undefined) return null;
  if (explain)
    return <PermissionSheet permission={Permission.camera} onAnswer={(go) => (go ? setExplain(false) : onClose())} />;
  return (
    <section className={C.card} aria-label={t("phone.in_scan")}>
      <QrScanner label={t("phone.in_scan_label")} onRead={onText} onProblem={(p) => onProblem(CAMERA[p])} />
      <div className={C.row}>
        <button type={C.button} className={C.secondaryCompact} onClick={onClose}>
          {t("qr.scan_close")}
        </button>
      </div>
    </section>
  );
}
