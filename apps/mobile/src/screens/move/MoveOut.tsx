import { Collection, log, type MessageKey, type Ports } from "@gigsync/core";
import { useEffect, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { movedAway, type ShownMove, showMoveCode } from "../../move/moveOut.js";
import { pauseSync } from "../../move/pause.js";
import { clockOf, moveErrorKey } from "../../move/problems.js";
import { C } from "../../ui/cls.js";
import { PageFrame } from "../pages/PageFrame.js";
import { StatusLine } from "./StatusLine.js";
import "../qr/qr.css";

/** How often the old phone asks whether the new one has taken over, while it shows its code. */
const MOVED_POLL_MS = 3000;
const TICK_MS = 1000;

/** Where the old phone is: before the code, making it, showing it, done, or ran out. */
const Stage = { intro: "intro", making: "making", showing: "showing", moved: "moved", expired: "expired" } as const;
type Stage = (typeof Stage)[keyof typeof Stage];

/** The code on screen until it runs out, with what it carries and what it leaves behind. */
function ShowingCode({ shown, now }: { shown: ShownMove; now: number }) {
  const { t } = useI18n();
  return (
    <section className={`${C.card} share-card`} aria-label={t("phone.move_out")}>
      <strong>{t("phone.out_keep_open")}</strong>
      <img className="qr" src={shown.image} alt={t("phone.out_qr_alt")} />
      <span className={C.label} role="timer">
        {t("phone.out_countdown", { time: clockOf(Date.parse(shown.expires_at) - now) })}
      </span>
      <span className={C.muted}>{t("phone.out_secret")}</span>
      <span className={C.muted}>{t("phone.out_safe")}</span>
      {shown.left_out.includes(Collection.chat) && <span className={C.muted}>{t("phone.out_left_chats")}</span>}
      {shown.unsent > 0 && <span className={C.muted}>{t("phone.out_unsent")}</span>}
    </section>
  );
}

interface Props {
  ports: Ports;
  account: Account;
  /** A sync of the mailbox (sending what is queued), run once before the records are packed. */
  sync: () => Promise<unknown>;
  /** The move is done: this phone signs out. */
  onSignOut: () => void;
}

/**
 * Settings › Move to a new phone, on the old phone: the steps, then the move QR with its countdown, "keep this screen
 * open", and what stays behind, until the new phone takes everything and signs this one out, which this screen then
 * says. The mailbox is left alone while the code is up, and checked again if the owner leaves or the code runs out.
 */
export function MoveOut({ ports, account, sync, onSignOut }: Props) {
  const { lang, t } = useI18n();
  const [stage, setStage] = useState<Stage>(Stage.intro);
  const [shown, setShown] = useState<ShownMove>();
  const [problem, setProblem] = useState<MessageKey>();
  const [now, setNow] = useState(() => Date.now());

  // Leaving the screen without moving lets the mailbox be checked again.
  useEffect(() => () => pauseSync(false), []);

  useEffect(() => {
    if (stage !== Stage.showing || !shown) return;
    const expires = Date.parse(shown.expires_at);
    const tick = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at < expires) return;
      pauseSync(false);
      setStage(Stage.expired);
    }, TICK_MS);
    const poll = setInterval(() => {
      void movedAway(account).then((moved) => moved && setStage(Stage.moved));
    }, MOVED_POLL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [stage, shown, account]);

  const start = async () => {
    setProblem(undefined);
    setStage(Stage.making);
    try {
      setShown(await showMoveCode(ports, account, lang, sync));
      setNow(Date.now());
      setStage(Stage.showing);
    } catch (err) {
      log.warn("move code not made", { error: err instanceof Error ? err.message : String(err) });
      setProblem(moveErrorKey(err));
      setStage(Stage.intro);
    }
  };

  if (stage === Stage.moved)
    return (
      <PageFrame title={t("phone.out_done_title")}>
        <section className={C.card} aria-label={t("phone.out_done_title")}>
          <StatusLine text={t("phone.out_done")} />
          <div className={C.actions}>
            <button type={C.button} className={C.accent} onClick={onSignOut}>
              {t("phone.out_ok")}
            </button>
          </div>
        </section>
      </PageFrame>
    );

  return (
    <PageFrame title={t("phone.out_title")} subtitle={t("phone.out_steps")}>
      {stage === Stage.showing && shown && <ShowingCode shown={shown} now={now} />}
      {stage === Stage.expired && <StatusLine className={C.card} text={t("phone.out_expired")} />}
      {problem && <StatusLine className={C.error} text={t(problem)} />}
      {stage !== Stage.showing && (
        <div className={C.actions}>
          <button type={C.button} className={C.accent} disabled={stage === Stage.making} onClick={() => void start()}>
            {t(stageButton(stage))}
          </button>
        </div>
      )}
    </PageFrame>
  );
}

/** The button under the steps: show the code, packing, or a new code after one ran out. */
function stageButton(stage: Stage): MessageKey {
  if (stage === Stage.making) return "phone.out_making";
  return stage === Stage.expired ? "phone.out_again" : "phone.out_start";
}
