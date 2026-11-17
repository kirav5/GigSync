import type { GigDevice, Ports } from "@gigsync/core";
import type { City, Session } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { useGuide } from "../help/useGuide.js";
import { AskPeople } from "./AskPeople.js";

interface Props {
  ports: Ports;
  session: Session;
  city: City;
  womenOnly: boolean;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
}

/**
 * The match was empty: say so plainly (and, with women-only on, that no woman mentor is listed yet), offer asking a
 * mentor for an introduction, and the guide's helplines under its draft label.
 */
export function NoMentor({ ports, session, city, womenOnly, device, run }: Props) {
  const { t } = useI18n();
  const guide = useGuide(ports, session, city)?.guide;
  const where = t(`mentor.city.${city}`);
  const title = t("mentor.none");
  return (
    <section className={C.card} aria-label={title}>
      <strong>{title}</strong>
      {womenOnly && <span>{t("mentor.none_women", { city: where })}</span>}
      <span>{t("mentor.none_intro", { city: where })}</span>
      <AskPeople device={device} run={run} city={city} />
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
