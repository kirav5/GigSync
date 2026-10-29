import type { Colleague, GigDevice, MessageKey } from "@gigsync/core";
import { City } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { linkedOnly, useColleagues } from "../colleague/context.js";
import { mentorProblem } from "./problems.js";

interface Props {
  device: GigDevice;
  colleague: Colleague;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** After asking: the note just sent shows in the thread. */
  onAsked: () => void;
}

/**
 * Introductions from a colleague's thread (round4-spec §2a): ask them whether they know someone in the city, or
 * introduce them to one of this owner's other linked colleagues, who knows it. No code to scan: both links vouch.
 */
export function IntroActions({ device, colleague, run, onAsked }: Props) {
  const { t } = useI18n();
  const { colleagues } = useColleagues();
  const [picking, setPicking] = useState(false);
  const [said, setSaid] = useState<{ key: MessageKey; other?: string }>();
  const city = City.enum.bengaluru;
  const where = t(`mentor.city.${city}`);
  const name = colleague.card.name;
  const others = linkedOnly(colleagues).filter((c) => c.user !== colleague.user);

  async function act(what: string, work: () => Promise<unknown>, done: MessageKey, other?: string) {
    try {
      await run(work);
      setSaid({ key: done, ...(other ? { other } : {}) });
      setPicking(false);
    } catch (err) {
      setSaid({ key: mentorProblem(what, err) });
    }
  }

  const pickTitle = t("mentor.intro_pick", { name, city: where });
  return (
    <div className={C.stack}>
      <div className={C.row}>
        <button
          type={C.button}
          className={C.quiet}
          onClick={() =>
            void act(
              "asking around failed",
              () => device.mentors.askAround(colleague.user, city),
              "mentor.intro_asked",
            ).then(onAsked)
          }
        >
          {t("mentor.intro_ask", { city: where })}
        </button>
        <button type={C.button} className={C.quiet} onClick={() => setPicking(!picking)}>
          {t("mentor.introduce", { name })}
        </button>
      </div>
      {picking && (
        <fieldset className={C.cardWait} aria-label={pickTitle}>
          <span className={C.label}>{pickTitle}</span>
          {others.length === 0 && <span className={C.muted}>{t("mentor.intro_none")}</span>}
          <div className={C.row}>
            {others.map((o) => (
              <button
                key={o.user}
                type={C.button}
                className={C.secondary}
                onClick={() =>
                  void act(
                    "introducing failed",
                    () => device.mentors.introduce({ newcomer: colleague.user, mentor: o.user, city }),
                    "mentor.intro_sent",
                    o.card.name,
                  )
                }
              >
                {t("mentor.intro_send", { name: o.card.name })}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {said && <p role="status">{t(said.key, { name, other: said.other ?? "" })}</p>}
    </div>
  );
}
