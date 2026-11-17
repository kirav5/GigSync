import type { Ports } from "@gigsync/core";
import { City, type Session, type UserId } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { ListCard, ListRow } from "../../ui/ListRow.js";
import { GuideLabel } from "../landing/GuideLabel.js";
import { LinksSection } from "../mentor/LinksSection.js";
import { PageFrame } from "../pages/PageFrame.js";
import { GuideLines, GuideUnions } from "./GuideHelp.js";
import { useGuide } from "./useGuide.js";

/** Only Bengaluru has a guide (ADR 0061 keeps guides and moving advice to it), so Help reads that one. */
const GUIDE_CITY = City.enum.bengaluru;

interface Props {
  ports: Ports;
  session: Session;
  /** A worker's Help adds mentors, moving to a new city and the unions; a household's keeps the rest. */
  worker: boolean;
  /** Opens Find a mentor, for someone who knows the work and the city. */
  onFindMentor: () => void;
  /** Opens one mentor link's thread, where its person can be blocked. */
  onOpenLink: (user: UserId) => void;
  /** Opens the Jobs tab, where each job has its own Report a problem. */
  onJobs: () => void;
  /** Opens Moving to a new city: the checklist for the first days and the city guide. */
  onMoving: () => void;
  /** Opens the terms and privacy notice. */
  onTerms: () => void;
}

/**
 * Help (design P5), from the profile: a headline and its line, then groups of rows, each an icon tile, a title, one
 * muted line and a chevron. Get help (for a worker a mentor and moving to a new city; for everyone a problem with a
 * job), the worker's mentor links with their new notes, the numbers the city guide lists (each a tap to call), the
 * unions it lists for a worker (each opening what the sources say), then the terms; the guide's own label closes the
 * page. The design's steward, per-job receipts and welfare-day count have nothing real behind them yet (ADR 0017,
 * ADR 0019), so none is drawn.
 */
export function HelpUnion({ ports, session, worker, onFindMentor, onOpenLink, onJobs, onMoving, onTerms }: Props) {
  const { t } = useI18n();
  const loaded = useGuide(ports, session, GUIDE_CITY);
  return (
    <PageFrame title={t("me.help_title")} subtitle={t("me.help_lead")}>
      <ListCard label={t("me.help_people")}>
        {worker && <ListRow icon="people" title={t("mentor.find")} sub={t("me.mentor_sub")} onClick={onFindMentor} />}
        {worker && <ListRow icon="pin" title={t("me.moving")} sub={t("me.moving_sub")} onClick={onMoving} />}
        <ListRow icon="flag" title={t("me.report")} sub={t("me.report_sub")} onClick={onJobs} />
      </ListCard>
      {worker && <LinksSection onOpen={onOpenLink} />}
      {loaded === undefined && <p className={C.muted}>{t("landing.loading")}</p>}
      {loaded === null && <p className={C.muted}>{t("landing.no_guide")}</p>}
      {loaded && <GuideLines guide={loaded.guide} />}
      {loaded && worker && <GuideUnions guide={loaded.guide} city={t(`landing.city.${GUIDE_CITY}`)} />}
      {loaded && <GuideLabel loaded={loaded} />}
      <ListCard label={t("me.help_about")}>
        <ListRow icon="doc" title={t("records.terms_title")} sub={t("me.terms_sub")} onClick={onTerms} />
      </ListCard>
    </PageFrame>
  );
}
