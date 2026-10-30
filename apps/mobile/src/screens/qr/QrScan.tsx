import { codeIn, type MessageKey } from "@gigsync/core";
import type { QrCode } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { CameraProblem } from "../../adapters/camera.js";
import { needsExplaining, Permission } from "../../adapters/permissions.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { PermissionSheet } from "../../ui/PermissionSheet.js";
import { QrScanner } from "../../ui/QrScanner.js";

/** Where scanning is: why the camera is needed, the camera, or stopped with a reason. */
const Stage = { explain: "explain", scan: "scan", stopped: "stopped" } as const;
type Stage = (typeof Stage)[keyof typeof Stage];

const CAMERA: Readonly<Record<CameraProblem, MessageKey>> = {
  [CameraProblem.denied]: "qr.camera_denied",
  [CameraProblem.none]: "qr.no_camera",
};

/**
 * Scans a GigSync QR with the camera, which is asked for only now, after the owner tapped Scan (on a native phone,
 * after saying why in the app's language). `onCode` gets the code of the first GigSync QR it reads.
 */
export function QrScan({ onCode, onClose }: { onCode: (code: QrCode) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [stage, setStage] = useState<Stage>();
  const [problem, setProblem] = useState<MessageKey>();
  const label = t("qr.scan");

  useEffect(() => {
    let live = true;
    void needsExplaining(Permission.camera)
      .catch(() => false)
      .then((explain) => {
        if (live) setStage(explain ? Stage.explain : Stage.scan);
      });
    return () => {
      live = false;
    };
  }, []);

  const stop = (why: MessageKey) => {
    setProblem(why);
    setStage(Stage.stopped);
  };
  const read = (text: string) => {
    const code = codeIn(text);
    if (code) onCode(code);
    else stop("qr.not_ours");
  };

  return (
    <section className={C.card} aria-label={label}>
      <span className={C.labelSq}>{label}</span>
      {stage === Stage.explain && (
        <PermissionSheet permission={Permission.camera} onAnswer={(go) => (go ? setStage(Stage.scan) : onClose())} />
      )}
      {stage === Stage.scan && (
        <QrScanner label={t("qr.scan_label")} onRead={read} onProblem={(p) => stop(CAMERA[p])} />
      )}
      {stage === Stage.stopped && problem && (
        <p className={C.error} role="status">
          {t(problem)}
        </p>
      )}
      <div className={C.row}>
        {stage === Stage.stopped && (
          <button type={C.button} className={C.secondaryCompact} onClick={() => setStage(Stage.scan)}>
            {label}
          </button>
        )}
        <button type={C.button} className={C.secondaryCompact} onClick={onClose}>
          {t("qr.scan_close")}
        </button>
      </div>
    </section>
  );
}
