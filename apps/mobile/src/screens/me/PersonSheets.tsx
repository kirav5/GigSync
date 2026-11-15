import type { MessageKey } from "@gigsync/core";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { BusyGroup } from "../../ui/BusyGroup.js";
import { C } from "../../ui/cls.js";
import { Sheet } from "../../ui/Sheet.js";
import { useBusy } from "../../ui/useBusy.js";
import { mentorProblem } from "../mentor/problems.js";

/** A quiet "No" under a confirm's answer, and its words. */
const GHOST = "btn ghost";
const CANCEL: MessageKey = "mentor.cancel";

/**
 * Runs a block or an unblock and says how it went. The phone's part stands even when the server could not be told
 * (core mentor/safety.ts), so the lists are read again either way; a failure keeps the sheet open with its reason.
 */
function useAct(act: () => Promise<unknown>, onDone: () => void) {
  const { busy, guard } = useBusy();
  const [problem, setProblem] = useState<MessageKey>();
  const go = async (what: string, close: () => void) => {
    try {
      await guard(act);
      close();
    } catch (err) {
      setProblem(mentorProblem(what, err));
    } finally {
      onDone();
    }
  };
  return { busy, problem, go };
}

interface PersonProps {
  name: string;
  /** What the row says of them, under their name in the sheet. */
  line: string;
  /** Asks them again, in a new chat to them alone; absent where the owner cannot (a worker's households). */
  onAsk?: (() => void) | undefined;
  /** Blocks them, on this phone and with the server. */
  block: () => Promise<unknown>;
  /** The lists moved: read them again. */
  onChanged: () => void;
  onClose: () => void;
}

/**
 * Someone the owner knows, tapped: Ask again where the owner can (a household asking a worker), and Block, which asks
 * once ("Block Ramesh?") in the same sheet before it hides them everywhere on this phone.
 */
export function PersonSheet({ name, line, onAsk, block, onChanged, onClose }: PersonProps) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const { busy, problem, go } = useAct(block, onChanged);
  if (!confirming)
    return (
      <Sheet title={name} line={line} icon="user" onClose={onClose}>
        {onAsk && (
          <button type={C.button} className={C.accent} onClick={onAsk}>
            {t("me.ask_again")}
          </button>
        )}
        <button type={C.button} className={C.secondary} onClick={() => setConfirming(true)}>
          {t("mentor.block")}
        </button>
        <button type={C.button} className={GHOST} onClick={onClose}>
          {t(CANCEL)}
        </button>
      </Sheet>
    );
  return (
    <Sheet
      title={t("me.block_title", { name })}
      line={t("me.block_about", { name })}
      icon="shield"
      danger
      onClose={onClose}
    >
      <BusyGroup busy={busy}>
        <button type={C.button} className={C.danger} onClick={() => void go("blocking failed", onClose)}>
          {t("mentor.block")}
        </button>
        <button type={C.button} className={GHOST} onClick={onClose}>
          {t(CANCEL)}
        </button>
        {problem && <p role="alert">{t(problem)}</p>}
      </BusyGroup>
    </Sheet>
  );
}

interface UnblockProps {
  name: string;
  /** Lets them back in, on this phone and with the server. */
  unblock: () => Promise<unknown>;
  onChanged: () => void;
  onClose: () => void;
}

/** "Unblock Ramesh?": once yes, they can ask, offer and write again, and show among the people the owner knows. */
export function UnblockSheet({ name, unblock, onChanged, onClose }: UnblockProps) {
  const { t } = useI18n();
  const { busy, problem, go } = useAct(unblock, onChanged);
  return (
    <Sheet
      title={t("me.unblock_title", { name })}
      line={t("me.unblock_about", { name })}
      icon="shield"
      onClose={onClose}
    >
      <BusyGroup busy={busy}>
        <button type={C.button} className={C.accent} onClick={() => void go("unblocking failed", onClose)}>
          {t("me.unblock")}
        </button>
        <button type={C.button} className={GHOST} onClick={onClose}>
          {t(CANCEL)}
        </button>
        {problem && <p role="alert">{t(problem)}</p>}
      </BusyGroup>
    </Sheet>
  );
}
