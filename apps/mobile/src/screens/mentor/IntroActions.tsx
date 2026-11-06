import type { GigDevice, KnownPerson, MessageKey } from "@gigsync/core";
import { City, type UserId } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { BusyGroup } from "../../ui/BusyGroup.js";
import { C } from "../../ui/cls.js";
import { useBusy } from "../../ui/useBusy.js";
import { mentorProblem } from "./problems.js";

interface Props {
  device: GigDevice;
  /** The person on this link or this signed job. */
  person: { user: UserId; name: string };
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Offer "Do you know someone in {city}?", asked of them. */
  ask?: boolean;
  /** Offer "Introduce {name} to someone": they are a worker. */
  introduce?: boolean;
  /** After asking: on a link, the note just sent shows in the thread. */
  onAsked?: () => void;
}

/**
 * Introductions from a mentor link or a finished signed job: ask them whether they know someone in the city, or
 * introduce them to another worker this owner knows the same ways. Both sides' dealings with this owner vouch for the
 * introduction; there is nothing to scan.
 */
export function IntroActions({ device, person, run, ask = false, introduce = false, onAsked }: Props) {
  const { t } = useI18n();
  const [others, setOthers] = useState<KnownPerson[]>();
  const [said, setSaid] = useState<{ key: MessageKey; other?: string }>();
  const city = City.enum.bengaluru;
  const where = t(`mentor.city.${city}`);
  const { user, name } = person;
  const { busy, guard } = useBusy();

  async function act(what: string, work: () => Promise<unknown>, done: MessageKey, other?: string) {
    try {
      await guard(() => run(work));
      setSaid({ key: done, ...(other ? { other } : {}) });
      setOthers(undefined);
      return true;
    } catch (err) {
      setSaid({ key: mentorProblem(what, err) });
      return false;
    }
  }
  async function pick() {
    if (others) return setOthers(undefined);
    try {
      await guard(async () => setOthers((await device.mentors.people()).filter((p) => p.worker && p.user !== user)));
    } catch (err) {
      setSaid({ key: mentorProblem("reading people known failed", err) });
    }
  }

  const pickTitle = t("mentor.intro_pick", { name, city: where });
  return (
    <div className={C.stack}>
      <BusyGroup busy={busy}>
        <div className={C.row}>
          {ask && (
            <button
              type={C.button}
              className={C.quiet}
              onClick={() =>
                void act("asking around failed", () => device.mentors.askAround(user, city), "mentor.intro_asked").then(
                  (ok) => ok && onAsked?.(),
                )
              }
            >
              {t("mentor.intro_ask", { city: where })}
            </button>
          )}
          {introduce && (
            <button type={C.button} className={C.quiet} onClick={() => void pick()}>
              {t("mentor.introduce", { name })}
            </button>
          )}
        </div>
        {others && (
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
                      () => device.mentors.introduce({ newcomer: user, mentor: o.user, city }),
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
      </BusyGroup>
      {said && <p role="status">{t(said.key, { name, other: said.other ?? "" })}</p>}
    </div>
  );
}
