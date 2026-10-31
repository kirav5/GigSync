import { FoundBy, GENERAL_STEPS, type Line, NATIONAL_LINES, type SectionRef } from "@gigsync/core";
import type { City, GuidePlace } from "@gigsync/protocol";
import type { ReactNode } from "react";
import { useI18n } from "../../i18n.js";
import { ActKind, type GuideAnswerKept, type MoveSpeaker, type MoveTurn } from "../../talk/moveTurns.js";
import type { Moves } from "../../talk/useMoves.js";
import { C } from "../../ui/cls.js";
import { SpeakButton } from "../../ui/SpeakButton.js";
import { ExternalLink, GUIDE_LANG, GuideText, SectionView } from "../landing/SectionView.js";
import { lineText, spoken } from "./Bubbles.js";

/**
 * A move to a new city in Talk, as the agent answers it: the outlook for the owner's work there, what to sort first
 * with the buttons that carry on from it, and the guide's answers as the guide wrote them, with their sources.
 */

const TEL = "tel:";
const SPACES = /\s+/g;
const LIST = "guide-list";
/** The agent's side of the chat, and the words in it. */
const BUBBLE = "msg-agent iv-ask";
const TEXT = "text";

type Of<W extends MoveTurn["who"]> = Extract<MoveTurn, { who: W }>;

/** Two lines can share a key (two trades' legal minimum); with their values they are told apart. */
const lineKey = (line: Line) => JSON.stringify(line);

/** The agent's lines, read out on tap, with whatever follows them in the same bubble. */
export function AgentLines({ lines, children }: { lines: readonly Line[]; children?: ReactNode }) {
  const i18n = useI18n();
  return (
    <div className={BUBBLE}>
      <div className="iv-say">
        <div className={TEXT}>
          {lines.map((line) => (
            <p key={lineKey(line)}>{lineText(i18n, line)}</p>
          ))}
        </div>
        <SpeakButton lang={i18n.lang} text={spoken(i18n, lines)} />
      </div>
      {children}
    </div>
  );
}

/** The outlook: the model's wording with the figures folded under it, or the figures. */
export function OutlookView({ turn }: { turn: Of<typeof MoveSpeaker.outlook> }) {
  const i18n = useI18n();
  const figures = turn.lines.map((line) => <p key={lineKey(line)}>{lineText(i18n, line)}</p>);
  if (!turn.phrased) return <AgentLines lines={turn.lines} />;
  return (
    <div className={BUBBLE}>
      <div className="iv-say">
        <div className={TEXT}>
          <p>{turn.phrased}</p>
        </div>
        <SpeakButton lang={i18n.lang} text={turn.phrased} />
      </div>
      <details>
        <summary className={C.faint}>{i18n.t("moving.figures")}</summary>
        <div className={TEXT}>{figures}</div>
      </details>
    </div>
  );
}

/** Section titles from the guide, as a list. */
function Steps({ steps }: { steps: readonly SectionRef[] }) {
  return (
    <ul className={LIST}>
      {steps.map((s) => (
        <li key={s.id}>
          <GuideText text={s.title} original={false} />
        </li>
      ))}
    </ul>
  );
}

/** The ways on from a move to a city with a guide. */
function MoveButtons({ city, moves }: { city: City; moves: Moves }) {
  const { t } = useI18n();
  const tap = (key: "moving.stay" | "moving.documents" | "moving.find", run: (c: City, label: string) => void) => (
    <button type={C.button} className={C.chip} disabled={moves.busy} onClick={() => run(city, t(key))}>
      {t(key)}
    </button>
  );
  return (
    <div className={`${C.row} iv-choices`}>
      {tap("moving.stay", moves.stay)}
      {tap("moving.documents", moves.documents)}
      {tap("moving.find", moves.find)}
      <button type={C.button} className={C.chip} onClick={() => moves.checklist(city)}>
        {t("moving.checklist")}
      </button>
    </div>
  );
}

/** A move to a city without a guide: what helps anywhere, and numbers that work in every city. */
function Anywhere() {
  const { t } = useI18n();
  return (
    <div className={TEXT}>
      <p>{t("moving.no_guide")}</p>
      <p>{t("moving.general")}</p>
      <ul className={LIST}>
        {GENERAL_STEPS.map((item) => (
          <li key={item}>{t(`landing.fixed_${item}`)}</li>
        ))}
      </ul>
      <p>{t("moving.lines")}</p>
      <ul className={LIST}>
        {NATIONAL_LINES.map((h) => (
          <li key={h.number}>
            <a className="helpline" href={`${TEL}${h.number.replace(SPACES, "")}`}>
              <span className={C.money}>{h.number}</span> {t(`moving.line.${h.name}`)}
            </a>{" "}
            <ExternalLink href={h.source}>{t("landing.source")}</ExternalLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The move: what to sort first and the buttons, or for a city without a guide, what helps anywhere. */
export function MovingView({ turn, moves }: { turn: Of<typeof MoveSpeaker.moving>; moves: Moves }) {
  const { t } = useI18n();
  const city = turn.city;
  if (!city)
    return (
      <div className={BUBBLE}>
        <Anywhere />
      </div>
    );
  return (
    <div className={BUBBLE}>
      <div className={TEXT}>
        <p>{t("moving.first", { city: t(`city.${city}`) })}</p>
        <Steps steps={turn.steps} />
      </div>
      <MoveButtons city={city} moves={moves} />
    </div>
  );
}

/** The guide's places to stay, folded: each with its area and the public page it is listed on. */
function Places({ places }: { places: readonly GuidePlace[] }) {
  const { t } = useI18n();
  return (
    <details>
      <summary className={C.label}>{t("moving.places", { count: places.length })}</summary>
      <span className={C.muted}>{t("landing.places_note")}</span>
      <ul className={LIST}>
        {places.map((p) => (
          <li key={p.name} className={C.stack}>
            <strong lang={GUIDE_LANG}>{p.name}</strong>
            <span lang={GUIDE_LANG}>{p.area}</span>
            <ExternalLink href={p.source}>{t("landing.source")}</ExternalLink>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** An answer from the guide: its section as written with its sources, its places, sections to open, or none. */
export function GuideView({ answer, moves }: { answer: GuideAnswerKept; moves: Moves }) {
  const { t } = useI18n();
  if (answer.none) return <AgentLines lines={[{ key: "moving.no_answer" }]} />;
  return (
    <section className={BUBBLE} aria-label={t("landing.ask_title")}>
      {answer.section && <SectionView section={answer.section} />}
      {answer.by === FoundBy.model && <span className={C.faint}>{t("landing.by_model")}</span>}
      {answer.places && answer.places.length > 0 && <Places places={answer.places} />}
      {answer.topics && (
        <>
          <span className={C.muted}>{t("moving.documents_lead")}</span>
          <div className={`${C.row} iv-choices`}>
            {answer.topics.map((s) => (
              <button
                key={s.id}
                type={C.button}
                className={C.chip}
                disabled={moves.busy}
                onClick={() => moves.act({ kind: ActKind.section, id: s.id }, s.title)}
              >
                <GuideText text={s.title} original={false} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
