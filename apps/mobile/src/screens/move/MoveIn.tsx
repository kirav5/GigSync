import { Collection, log, MergeChoice, type MessageKey, type Ports } from "@gigsync/core";
import { useState } from "react";
import type { Account } from "../../adapters/account.js";
import { loadFind } from "../../find/findChats.js";
import { useI18n } from "../../i18n.js";
import { keepMovedRecords, type MovedIn, type OpenedHere, openMoveCode, signOutOldPhone } from "../../move/moveIn.js";
import { moveErrorKey } from "../../move/problems.js";
import { answerMovePrompt } from "../../move/useMovePrompt.js";
import { loadTalk } from "../../talk/talkStore.js";
import { C } from "../../ui/cls.js";
import { PageFrame } from "../pages/PageFrame.js";
import { MoveScan } from "./MoveScan.js";
import { StatusLine } from "./StatusLine.js";

/** Where the new phone is: asking, scanning, bringing records over, asking about differences, or done. */
const Stage = { ask: "ask", scan: "scan", busy: "busy", conflict: "conflict", done: "done" } as const;
type Stage = (typeof Stage)[keyof typeof Stage];

interface Props {
  ports: Ports;
  account: Account;
  onAccount: (a: Account) => void;
  /** Leaves the screen: after the move, or when the owner says not now. */
  onDone: () => void;
}

/** The end: what arrived, what stayed behind, and the old phone signed out (or a retry when it could not be yet). */
function Done({
  moved,
  signedOut,
  onRetry,
  onDone,
}: {
  moved: MovedIn;
  signedOut: boolean;
  onRetry: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  return (
    <section className={C.card} aria-label={t("phone.in_done_title")}>
      <StatusLine text={t(signedOut ? "phone.in_done" : "phone.in_revoke_failed")} />
      {moved.left_out.includes(Collection.chat) && <span className={C.muted}>{t("phone.in_left_chats")}</span>}
      <div className={C.actions}>
        {!signedOut && (
          <button type={C.button} className={C.secondary} onClick={onRetry}>
            {t("phone.in_revoke_again")}
          </button>
        )}
        <button type={C.button} className={C.accent} onClick={onDone}>
          {t("phone.in_continue")}
        </button>
      </div>
    </section>
  );
}

/**
 * "Moving from another phone? Scan its code", after sign-in on a phone with nothing of the owner's yet, and in Settings.
 * Scans the old phone's move code, brings its records over, asks once when some differ on the two phones (never
 * overwriting this phone's without that), then signs the old phone out and says so.
 */
export function MoveIn({ ports, account, onAccount, onDone }: Props) {
  const { t, setLang } = useI18n();
  const [stage, setStage] = useState<Stage>(Stage.ask);
  const [problem, setProblem] = useState<MessageKey>();
  const [here, setHere] = useState<OpenedHere>();
  const [moved, setMoved] = useState<MovedIn>();
  const [signedOut, setSignedOut] = useState(false);

  const fail = (err: unknown) => {
    log.warn("move in failed", { error: err instanceof Error ? err.message : String(err) });
    setProblem(moveErrorKey(err));
    setStage(Stage.ask);
  };

  const signOutOld = async (from: MovedIn["from"]) => {
    try {
      await signOutOldPhone(account, from);
      setSignedOut(true);
    } catch (err) {
      log.warn("old phone not signed out", { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const keep = async (opened: OpenedHere, choice: MergeChoice) => {
    setStage(Stage.busy);
    try {
      const result = await keepMovedRecords(ports, account, opened, choice);
      onAccount(result.account);
      if (result.lang) setLang(result.lang);
      await Promise.all([loadTalk(ports), loadFind(ports)]);
      setMoved(result);
      await signOutOld(result.from);
      setStage(Stage.done);
    } catch (err) {
      fail(err);
    }
  };

  const scanned = async (text: string) => {
    setStage(Stage.busy);
    try {
      const opened = await openMoveCode(ports, account, text);
      setHere(opened);
      if (opened.plan.conflicts.length > 0) setStage(Stage.conflict);
      else await keep(opened, MergeChoice.keepMine);
    } catch (err) {
      fail(err);
    }
  };

  const scan = () => {
    setProblem(undefined);
    void answerMovePrompt(ports, account.session.user);
    setStage(Stage.scan);
  };
  const notNow = () => {
    void answerMovePrompt(ports, account.session.user);
    onDone();
  };

  return (
    <PageFrame
      title={t(stage === Stage.done ? "phone.in_done_title" : "phone.in_title")}
      {...(stage === Stage.done ? {} : { subtitle: t("phone.in_about") })}
    >
      {stage === Stage.scan && (
        <MoveScan
          onText={(text) => void scanned(text)}
          onProblem={(why) => {
            setProblem(why);
            setStage(Stage.ask);
          }}
          onClose={() => setStage(Stage.ask)}
        />
      )}
      {stage === Stage.busy && <StatusLine className={C.cardWait} text={t("phone.in_opening")} />}
      {stage === Stage.conflict && here && (
        <section className={C.card} aria-label={t("phone.in_title")}>
          <span>{t("phone.in_conflict", { count: here.plan.conflicts.length })}</span>
          <div className={C.actions}>
            <button type={C.button} className={C.accent} onClick={() => void keep(here, MergeChoice.keepMine)}>
              {t("phone.in_keep_mine")}
            </button>
            <button type={C.button} className={C.secondary} onClick={() => void keep(here, MergeChoice.takeTheirs)}>
              {t("phone.in_take_theirs")}
            </button>
          </div>
        </section>
      )}
      {stage === Stage.done && moved && (
        <Done moved={moved} signedOut={signedOut} onRetry={() => void signOutOld(moved.from)} onDone={onDone} />
      )}
      {problem && <StatusLine className={C.error} text={t(problem)} />}
      {stage === Stage.ask && (
        <div className={C.actions}>
          <button type={C.button} className={C.accent} onClick={scan}>
            {t("phone.in_scan")}
          </button>
          <button type={C.button} className={C.secondary} onClick={notNow}>
            {t("phone.in_not_now")}
          </button>
        </div>
      )}
    </PageFrame>
  );
}
