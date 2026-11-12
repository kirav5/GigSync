import type { Ports } from "@gigsync/core";
import { City, type Session, type UserId } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { ListCard, ListRow } from "../../ui/ListRow.js";
import { GuideLabel } from "../landing/GuideLabel.js";
import { LinksSection } from "../mentor/LinksSection.js";
import { GuideLines, GuideUnions } from "./GuideHelp.js";
import { useGuide } from "./useGuide.js";
import "./help.css";

/** Only Bengaluru has a guide (ADR 0061 keeps guides and moving advice to it), so Help reads that one. */
const GUIDE_CITY = City.enum.bengaluru;

interface Props {
  ports: Ports;
  session: Session;
  /** Opens Find a mentor, for someone who knows the work and the city. */
  onFindMentor: () => void;
  /** Opens one mentor link's thread, where its person can be blocked. */
  onOpenLink: (user: UserId) => void;
  /** Opens the Jobs tab, where each job has its own Report a problem. */
  onJobs: () => void;
}

/**
 * Help (design P5), from Me: a mentor, the way to report a problem with a job, the worker's mentor links with their new
 * notes, then what the city guide lists: numbers to call and the unions, under the guide's own label. The design's
 * steward, per-job receipts and welfare-day count have nothing real behind them yet (ADR 0017, ADR 0019), so none is
 * drawn.
 */
export function HelpUnion({ ports, session, onFindMentor, onOpenLink, onJobs }: Props) {
  const { t } = useI18n();
  const loaded = useGuide(ports, session, GUIDE_CITY);
  return (
    <>
      <ListCard>
        <ListRow icon="people" title={t("mentor.find")} sub={t("me.mentor_sub")} onClick={onFindMentor} />
        <ListRow icon="flag" title={t("me.report")} sub={t("me.report_sub")} onClick={onJobs} />
      </ListCard>
      <LinksSection onOpen={onOpenLink} />
      {loaded === undefined && <p className={C.muted}>{t("landing.loading")}</p>}
      {loaded === null && <p className={C.muted}>{t("landing.no_guide")}</p>}
      {loaded && <GuideLines guide={loaded.guide} />}
      {loaded && <GuideUnions guide={loaded.guide} city={t(`landing.city.${GUIDE_CITY}`)} />}
      {loaded && <GuideLabel loaded={loaded} />}
    </>
  );
}
