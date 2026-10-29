import type { GigDevice, MessageKey } from "@gigsync/core";
import { type ColleagueCard, type LinkInvite, parseInvite, type UserId } from "@gigsync/protocol";
import { type FormEvent, useEffect, useState } from "react";
import { CameraProblem } from "../../adapters/camera.js";
import { needsExplaining, Permission } from "../../adapters/permissions.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { PermissionSheet } from "../../ui/PermissionSheet.js";
import { QrScanner } from "../../ui/QrScanner.js";
import { colleagueProblem } from "./problems.js";

/** Where scanning is: why the camera is needed, the camera, "link with …?", or stopped with a reason. */
const Stage = { explain: "explain", scan: "scan", confirm: "confirm", stopped: "stopped" } as const;
type Stage = (typeof Stage)[keyof typeof Stage];

const CAMERA: Readonly<Record<CameraProblem, MessageKey>> = {
  [CameraProblem.denied]: "colleague.camera_denied",
  [CameraProblem.none]: "colleague.no_camera",
};
/** The dev-only paste field's name. */
const PASTE = "code";

interface Props {
  device: GigDevice;
  me: UserId;
  card: ColleagueCard;
  /** The request went to the colleague's phone; they are linked once it answers. */
  onAsked: (user: UserId) => void;
  onCancel: () => void;
}

/**
 * Scans a colleague's code with the camera (on a native phone, after saying why in the app's language), shows whose it
 * is and asks before anything is sent. Dev builds also take the code's text pasted in, for tests without a camera.
 */
export function ScanCode({ device, me, card, onAsked, onCancel }: Props) {
  const { t } = useI18n();
  const [stage, setStage] = useState<Stage>();
  const [found, setFound] = useState<{ invite: LinkInvite; payload: string }>();
  const [problem, setProblem] = useState<MessageKey>();
  const [busy, setBusy] = useState(false);
  const scanLabel = t("colleague.scan");
  const pasteLabel = t("colleague.paste");

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

  function stop(why: MessageKey) {
    setProblem(why);
    setStage(Stage.stopped);
  }

  function read(text: string) {
    const payload = text.trim();
    const invite = parseInvite(payload);
    if (!invite) return stop("colleague.bad_code");
    if (invite.u === me) return stop("colleague.own_code");
    setProblem(undefined);
    setFound({ invite, payload });
    setStage(Stage.confirm);
  }

  function paste(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    read(String(new FormData(e.currentTarget).get(PASTE) ?? ""));
  }

  async function link() {
    if (!found) return;
    setBusy(true);
    try {
      const colleague = await device.colleagues.link(found.payload, card);
      onAsked(colleague.user);
    } catch (err) {
      stop(colleagueProblem("linking a colleague failed", err));
    } finally {
      setBusy(false);
    }
  }

  const confirm = found ? t("colleague.confirm", { name: found.invite.n }) : "";
  return (
    <section className={`${C.card} colleague-scan`} aria-label={scanLabel}>
      <span className={C.labelSq}>{scanLabel}</span>
      {stage === Stage.explain && (
        <PermissionSheet permission={Permission.camera} onAnswer={(go) => (go ? setStage(Stage.scan) : onCancel())} />
      )}
      {stage === Stage.scan && <QrScanner label={scanLabel} onRead={read} onProblem={(p) => stop(CAMERA[p])} />}
      {stage === Stage.confirm && found && (
        <div className={C.stack} role="dialog" aria-label={confirm}>
          <p>{confirm}</p>
          <div className={C.actions}>
            <button type={C.button} className={C.accent} disabled={busy} onClick={() => void link()}>
              {t("colleague.link")}
            </button>
            <button type={C.button} className={C.secondary} onClick={onCancel}>
              {t("colleague.cancel")}
            </button>
          </div>
        </div>
      )}
      {stage === Stage.stopped && (
        <>
          {problem && (
            <p className={C.error} role="status">
              {t(problem, { name: found?.invite.n ?? "" })}
            </p>
          )}
          <div className={C.actions}>
            <button type={C.button} className={C.secondary} onClick={() => setStage(Stage.scan)}>
              {scanLabel}
            </button>
          </div>
        </>
      )}
      {import.meta.env.DEV && (
        <form className={C.row} aria-label={pasteLabel} onSubmit={paste}>
          <input className={C.field} name={PASTE} aria-label={pasteLabel} placeholder={pasteLabel} />
          <button type={C.submit} className={C.btn}>
            {t("colleague.link")}
          </button>
        </form>
      )}
    </section>
  );
}
