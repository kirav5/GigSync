import type { GigDevice, KnownPerson, MessageKey } from "@gigsync/core";
import type { City } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { mentorProblem } from "./problems.js";

interface Props {
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  city: City;
}

/**
 * The people a newcomer can ask whether they know someone in `city`: a live mentor link (the ask is a note in its
 * thread) or the other side of a job both signed (it lands with that job on their phone). One tap asks one person.
 */
export function AskPeople({ device, run, city }: Props) {
  const { t } = useI18n();
  const [people, setPeople] = useState<KnownPerson[]>();
  const [said, setSaid] = useState<{ key: MessageKey; name: string }>();

  useEffect(() => {
    let live = true;
    device.mentors.people().then(
      (all) => {
        if (live) setPeople(all.filter((p) => p.channel !== undefined));
      },
      (err: unknown) => setSaid({ key: mentorProblem("reading people known failed", err), name: "" }),
    );
    return () => {
      live = false;
    };
  }, [device]);

  async function ask(p: KnownPerson) {
    const name = p.card.name;
    try {
      await run(() => device.mentors.askAround(p.user, city));
      setSaid({ key: "mentor.intro_asked", name });
    } catch (err) {
      setSaid({ key: mentorProblem("asking around failed", err), name });
    }
  }

  if (!people) return null;
  return (
    <div className={C.stack}>
      {people.length === 0 && <span className={C.muted}>{t("mentor.no_people")}</span>}
      <div className={C.row}>
        {people.map((p) => (
          <button key={p.user} type={C.button} className={C.secondary} onClick={() => void ask(p)}>
            {t("mentor.ask_person", { name: p.card.name })}
          </button>
        ))}
      </div>
      {said && <p role="status">{t(said.key, { name: said.name })}</p>}
    </div>
  );
}
