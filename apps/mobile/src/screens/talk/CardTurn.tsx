import {
  CardPick,
  type Choice,
  cardEstimate,
  draftOf,
  estimateLines,
  type FoundEstimate,
  type InterviewState,
  type Line,
  type MessageKey,
  prompt,
  Slot,
} from "@gigsync/core";
import type { Account } from "../../adapters/account.js";
import { tapInterview } from "../../card/interviewStore.js";
import { draftCard, radiusOf } from "../../card/publish.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { CardFace } from "../card/CardFace.js";
import { RangeBand } from "../estimate/RangeBand.js";
import { Ask, lineText } from "./Bubbles.js";
import { Choices } from "./ChoiceChips.js";
import { ownChips, sayChip } from "./cardAsk.js";
import { LocateArea } from "./LocateArea.js";
import { LowestAsk, PriceAsk } from "./PriceAsk.js";
import { RadiusAsk } from "./RadiusAsk.js";

/** The question whose answer is private: its turn carries the lock line even once answered. */
const MIN_QUESTION: MessageKey = "iv.ask.min";
/** The lock beside "Stays on this phone", the size of its words, as on the lowest card (PriceAsk.tsx). */
const LOCK_PX = 16;
/** The estimate under another arrangement's rate, with where its lines start in the turn; none for others. */
function bandOf(lines: readonly Line[], state: InterviewState): { found: FoundEstimate; from: number } | undefined {
  if (state.slot !== Slot.more_rates) return undefined;
  const found = cardEstimate(state);
  // The range is the estimate's first line; the language only changes its words, never its key.
  const range = found && estimateLines(state.config.own, found)[0]?.key;
  const from = range ? lines.findIndex((l) => l.key === range) : -1;
  return found && from > 0 ? { found, from } : undefined;
}

/**
 * The going rate under another arrangement's rate (W3): the range in words over the band, then what it rests on and the
 * amount suggested, in their own card. Shown, never imposed: the chips under it use the suggestion or the owner's own.
 */
function RateCard({ found, lines }: { found: FoundEstimate; lines: readonly Line[] }) {
  const i18n = useI18n();
  const [range, ...rest] = lines;
  return (
    <div className={`${C.card} iv-estimate`}>
      {range && <p className="iv-estimate-range">{lineText(i18n, range)}</p>}
      <RangeBand found={found} />
      {rest.map((line) => (
        <p key={line.key} className="fine">
          {lineText(i18n, line)}
        </p>
      ))}
    </div>
  );
}

/**
 * One turn of the card interview: the agent's lines and, while it is the question now asked (`live`), what goes with
 * it: the price card under the usual rate (PriceAsk.tsx), the lowest card under the private one, the going rate's card
 * under another arrangement's rate, the lock line on the private one once answered, the picture chips, Use my
 * location under the area, the distance map, its quick chips and slider over how far they go, and at the summary the
 * card face above it all (W5). There the dock asks to put it on the board, so the yes and no chips stand aside.
 */
export function CardTurn({
  lines,
  choices,
  live,
  account,
}: {
  lines: readonly Line[];
  choices: readonly Choice[];
  live: InterviewState | undefined;
  account: Account;
}) {
  const { t, lang } = useI18n();
  const asked = live && prompt(live);
  const band = live && bandOf(lines, live);
  // The price cards stand aside while an amount far from the usual is asked back as yes or no.
  const card = live?.pending === undefined ? live?.slot : undefined;
  const secret = (lines.some((l) => l.key === MIN_QUESTION) || asked?.secret === true) && card !== Slot.min;
  const draft = live?.slot === Slot.confirm ? draftOf(live) : undefined;
  const face = draft && draftCard(account, draft, lang);
  return (
    <>
      {draft && face && <CardFace card={face} km={radiusOf(account, draft)} />}
      <Ask lines={lines} split={band?.from}>
        {band && <RateCard found={band.found} lines={lines.slice(band.from)} />}
        {secret && (
          <p className="price-private iv-private">
            <Icon name="lock" size={LOCK_PX} />
            {t("cardflow.private")}
          </p>
        )}
        {live?.slot === Slot.radius && <RadiusAsk draft={draftOf(live)} />}
        {live && card === Slot.rate && <PriceAsk state={live} />}
        {live && card === Slot.min && <LowestAsk state={live} />}
        {live && asked && (
          <Choices choices={ownChips(live) ? [] : choices} picked={asked.picked} say={sayChip(live, asked)} />
        )}
        {live?.slot === Slot.area && <LocateArea session={account.session} />}
      </Ask>
    </>
  );
}

/**
 * The summary's two answers in the dock (W5): put the card on the board, the one primary action, or change something,
 * quiet. The same answers as the yes and no chips; saying yes or no still works.
 */
export function PublishActions() {
  const { t } = useI18n();
  const yes = t("cardflow.put_on_board");
  const no = t("cardflow.change_something");
  return (
    <div className="iv-publish">
      <button type={C.button} className={`${C.wide} btn-big`} onClick={() => tapInterview(CardPick.yes, yes)}>
        <Icon name="tick" />
        {yes}
      </button>
      <button type={C.button} className={`${C.quiet} wide`} onClick={() => tapInterview(CardPick.no, no)}>
        {no}
      </button>
    </div>
  );
}
