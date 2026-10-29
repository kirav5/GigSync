import { ColleagueState, type GigDevice, type MessageKey } from "@gigsync/core";
import { type ColleagueCard, LINK_CODE_TTL_MS, type UserId } from "@gigsync/protocol";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";
import { qrDataUrl } from "../../payments/qr.js";
import { C } from "../../ui/cls.js";
import { useColleagues } from "./context.js";
import { colleagueProblem } from "./problems.js";

/** The countdown moves once a second. */
const TICK_MS = 1000;
const MS_PER_MINUTE = 60_000;
/** Dev builds only: the invite's text on the QR, so a test on one browser can hand it to another without a camera. */
const INVITE_ATTR = "data-invite";

interface Code {
  payload: string;
  qr: string;
  /** When this phone made it, in ms: it works for LINK_CODE_TTL_MS from then. */
  at: number;
}

/**
 * The worker's colleague code as a QR, for a worker they met to scan, with their name and how many minutes it still
 * works. Once it runs out, a new one is a tap away. When the other phone's request arrives and links the two,
 * `onLinked` says who it was.
 */
export function ShowCode({
  device,
  card,
  onLinked,
}: {
  device: GigDevice;
  card: ColleagueCard;
  onLinked: (user: UserId) => void;
}) {
  const { t, plural } = useI18n();
  const { colleagues } = useColleagues();
  const [code, setCode] = useState<Code>();
  const [problem, setProblem] = useState<MessageKey>();
  const [now, setNow] = useState(() => Date.now());
  const label = t("colleague.qr_label");

  const make = useCallback(async () => {
    setProblem(undefined);
    try {
      const payload = await device.colleagues.invite(card);
      const qr = await qrDataUrl(payload);
      const at = Date.now();
      setCode({ payload, qr, at });
      setNow(at);
    } catch (err) {
      setProblem(colleagueProblem("making a colleague code failed", err));
    }
  }, [device, card]);

  useEffect(() => {
    void make();
  }, [make]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // The scanning phone asked with this code, and this phone linked the two.
  useEffect(() => {
    if (!code) return;
    const fresh = colleagues.find(
      (c) => c.state === ColleagueState.linked && c.linked_at !== undefined && Date.parse(c.linked_at) >= code.at,
    );
    if (fresh) onLinked(fresh.user);
  }, [colleagues, code, onLinked]);

  const left = code ? code.at + LINK_CODE_TTL_MS - now : 0;
  const expired = code !== undefined && left <= 0;
  return (
    <section className={`${C.card} colleague-code`} aria-label={label}>
      <span className={C.labelSq}>{label}</span>
      {code && !expired && (
        <>
          <img src={code.qr} alt={label} {...(import.meta.env.DEV ? { [INVITE_ATTR]: code.payload } : {})} />
          <strong>{card.name}</strong>
          <span>{t("colleague.code_help")}</span>
          <span className={C.muted} role="timer">
            {plural("colleague.code_expires", Math.ceil(left / MS_PER_MINUTE))}
          </span>
        </>
      )}
      {expired && (
        <>
          <p role="status">{t("colleague.code_expired")}</p>
          <button type={C.button} className={C.accent} onClick={() => void make()}>
            {t("colleague.new_code")}
          </button>
        </>
      )}
      {problem && (
        <p className={C.error} role="status">
          {t(problem)}
        </p>
      )}
    </section>
  );
}
