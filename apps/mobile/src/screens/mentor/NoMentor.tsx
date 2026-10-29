import { loadGuide, log, type Ports } from "@gigsync/core";
import type { City, Helpline, Session } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { apiClient } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/** The city guide's helplines and the label it carries, from the copy on this phone or a fresh download. */
function useHelplines(ports: Ports, session: Session, city: City) {
  const [found, setFound] = useState<{ helplines: readonly Helpline[]; label: string }>();
  useEffect(() => {
    let live = true;
    const fetchGuide = (c: City) => apiClient(session).cityGuide(c);
    loadGuide(ports.storage, fetchGuide, city, ports.clock.now()).then(
      (loaded) => {
        if (live && loaded) setFound({ helplines: loaded.guide.helplines, label: loaded.guide.label });
      },
      (err: unknown) => log.warn("guide not loaded", { error: err instanceof Error ? err.message : String(err) }),
    );
    return () => {
      live = false;
    };
  }, [ports, session, city]);
  return found;
}

interface Props {
  ports: Ports;
  session: Session;
  city: City;
  womenOnly: boolean;
  /** Opens the Colleagues list, where a colleague can be asked whether they know someone. */
  onColleagues: () => void;
}

/**
 * The match was empty: say so plainly (and, with women-only on, that no woman mentor is listed yet), offer asking a
 * colleague for an introduction, and the guide's helplines under its draft label.
 */
export function NoMentor({ ports, session, city, womenOnly, onColleagues }: Props) {
  const { t } = useI18n();
  const guide = useHelplines(ports, session, city);
  const where = t(`mentor.city.${city}`);
  const title = t("mentor.none");
  return (
    <section className={C.card} aria-label={title}>
      <strong>{title}</strong>
      {womenOnly && <span>{t("mentor.none_women", { city: where })}</span>}
      <span>{t("mentor.none_intro", { city: where })}</span>
      <div className={C.actions}>
        <button type={C.button} className={C.secondary} onClick={onColleagues}>
          {t("colleague.title")}
        </button>
      </div>
      {guide && guide.helplines.length > 0 && (
        <div className={C.stack}>
          <span className={C.label}>{t("mentor.helplines")}</span>
          <span className={C.faint}>{guide.label}</span>
          <ul className="mentor-helplines">
            {guide.helplines.map((h) => (
              <li key={h.number}>
                <a href={`tel:${h.number.replace(/\s+/g, "")}`}>{h.number}</a> <span className={C.muted}>{h.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
