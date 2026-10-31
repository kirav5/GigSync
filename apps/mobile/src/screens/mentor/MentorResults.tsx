import type { MentorProfile } from "@gigsync/protocol";
import { MAX_LANDING_REQUESTS } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { areaLabel } from "../../ui/places.js";
import { MentorFacts } from "./MentorFacts.js";

/**
 * The mentors the server matched, most jobs first as it sent them: the newcomer chooses up to three. No ranking of
 * this phone's own, and no model choosing for them.
 */
export function MentorResults({
  mentors,
  picked,
  onPick,
}: {
  mentors: readonly MentorProfile[];
  picked: readonly MentorProfile[];
  onPick: (mentor: MentorProfile) => void;
}) {
  const { lang, t } = useI18n();
  const full = picked.length >= MAX_LANDING_REQUESTS;
  return (
    <ul className="mentor-results" aria-label={t("mentor.find")}>
      {mentors.map((m) => {
        const chosen = picked.some((p) => p.user === m.user);
        return (
          <li key={m.user} className={C.card}>
            <strong>{m.first_name}</strong>
            <MentorFacts facts={{ ...m, area: areaLabel(lang, m.area) }} />
            <button
              type={C.button}
              aria-pressed={chosen}
              className={chosen ? C.chipOn : C.chip}
              disabled={!chosen && full}
              onClick={() => onPick(m)}
            >
              {chosen ? t("mentor.chosen") : t("mentor.choose", { name: m.first_name })}
            </button>
          </li>
        );
      })}
      {full && <li className={C.faint}>{t("mentor.max", { count: MAX_LANDING_REQUESTS })}</li>}
    </ul>
  );
}
