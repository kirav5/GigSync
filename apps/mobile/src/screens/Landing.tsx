import type { JobRecord, Journey, LoadedGuide, Ports } from "@gigsync/core";
import { type City, GuideStatus } from "@gigsync/protocol";
import { useState } from "react";
import type { Account } from "../adapters/account.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { AskGuide } from "./landing/AskGuide.js";
import { CashPlan } from "./landing/CashPlan.js";
import { dayAt } from "./landing/day.js";
import { Helplines, NotChecked, Places, Registration } from "./landing/GuideLists.js";
import { JourneySteps } from "./landing/JourneySteps.js";
import { LandingStart } from "./landing/LandingStart.js";
import { GuideText } from "./landing/SectionView.js";
import { useLanding } from "./landing/useLanding.js";
import "./landing/landing.css";

interface Props {
  ports: Ports;
  account: Account;
  /** This phone's jobs, so a job both signed in the new city ticks "first job". */
  jobs: readonly JobRecord[];
  /** The city Talk heard ("I'm moving to Bengaluru"), to start with it picked. */
  city: City | undefined;
  /** Opens Find a mentor (builder M's screens), for someone who knows the city. */
  onFindMentor: () => void;
}

/** The label every screen showing the guide carries: the app's own words for a draft, else the guide's. */
function GuideLabel({ loaded }: { loaded: LoadedGuide }) {
  const { t, date } = useI18n();
  const draft = loaded.guide.status === GuideStatus.enum.draft;
  return (
    <div className="guide-label" role="note">
      <strong>{draft ? t("landing.draft") : <GuideText text={loaded.guide.label} original={false} />}</strong>
      {loaded.offline && <span className={C.muted}>{t("landing.offline", { date: date(new Date(loaded.at)) })}</span>}
    </div>
  );
}

/** Someone who knows the city: the mentor screens, where the newcomer chooses. */
function Mentor({ onFindMentor }: Pick<Props, "onFindMentor">) {
  const { t } = useI18n();
  return (
    <div className={C.actions}>
      <button type={C.button} className={C.secondary} onClick={onFindMentor}>
        {t("landing.mentor")}
      </button>
    </div>
  );
}

/** Removing the move from this phone, with one confirm. */
function RemoveMove({ onRemove }: { onRemove: () => void }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type={C.button} className={C.quiet} onClick={() => setAsking(true)}>
        {t("landing.remove")}
      </button>
    );
  return (
    <div className={C.cardWait} role="dialog" aria-label={t("landing.remove")}>
      <p>{t("landing.remove_confirm")}</p>
      <div className={C.actions}>
        <button type={C.button} className={C.danger} onClick={onRemove}>
          {t("landing.remove_yes")}
        </button>
        <button type={C.button} className={C.secondary} onClick={() => setAsking(false)}>
          {t("landing.keep")}
        </button>
      </div>
    </div>
  );
}

/** The move under way: the guide's label, Ask the guide, the steps and checklist, then the guide's lists. */
function JourneyView(props: Props & { journey: Journey; loaded: LoadedGuide; landing: ReturnType<typeof useLanding> }) {
  const { journey, loaded, landing, ports, onFindMentor } = props;
  const { t, date } = useI18n();
  const { guide } = loaded;
  return (
    <>
      <span className={C.muted}>
        {t("landing.arriving", {
          city: t(`landing.city.${journey.city}`),
          date: date(dayAt(journey.arrival)),
          trade: t(`trade.${journey.trade}`),
        })}
      </span>
      <GuideLabel loaded={loaded} />
      <AskGuide guide={guide} model={ports.model} />
      <JourneySteps journey={journey} guide={guide} onChange={(next) => void landing.change(next)} />
      <Helplines guide={guide} />
      <Mentor onFindMentor={onFindMentor} />
      <Places guide={guide} />
      <Registration guide={guide} />
      <CashPlan guide={guide} arrival={journey.arrival} />
      <NotChecked guide={guide} />
      <RemoveMove onRemove={() => void landing.remove()} />
    </>
  );
}

/**
 * Moving to a new city for work (round 4, flow 3): pick the city, the day and the work, then a journey kept on this
 * phone, step by step, from the city's guide. The guide is a draft from public sources and every part of this screen
 * says so; once downloaded it opens without a network.
 */
export function Landing(props: Props) {
  const { ports, account, jobs, city } = props;
  const { t } = useI18n();
  const landing = useLanding(ports, account, jobs);
  const { journey, guide } = landing;
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("nav.talk")}</span>
        <h1 className={C.headline}>{t("landing.title")}</h1>
      </div>
      {journey === null && <LandingStart city={city} trade={account.worker?.trades[0]} onStart={landing.start} />}
      {journey && guide === undefined && <p className={C.muted}>{t("landing.loading")}</p>}
      {journey && guide === null && <p className={C.error}>{t("landing.no_guide")}</p>}
      {journey && guide && <JourneyView {...props} journey={journey} loaded={guide} landing={landing} />}
    </>
  );
}
