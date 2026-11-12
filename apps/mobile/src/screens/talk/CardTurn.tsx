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
import { Badge, BadgeTone } from "../../ui/Badge.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { CardFace } from "../card/CardFace.js";
import { RangeBand } from "../estimate/RangeBand.js";
import { Ask, lineText } from "./Bubbles.js";
import { Choices } from "./ChoiceChips.js";
import { readyToPublish, sayChip } from "./cardAsk.js";
import { LocateArea } from "./LocateArea.js";

/** The question whose answer is private: its turn carries the lock badge even once answered. */
const MIN_QUESTION: MessageKey = "iv.ask.min";
/** The questions that show the usual range as the band: the usual rate, and another arrangement's. */
const RATE_SLOTS: ReadonlySet<Slot> = new Set([Slot.rate, Slot.more_rates]);

/** The estimate under the price question now asked, with where its lines start in the turn; none for others. */
function bandOf(lines: readonly Line[], state: InterviewState): { found: FoundEstimate; from: number } | undefined {
  if (!RATE_SLOTS.has(state.slot) || state.pending !== undefined) return undefined;
  const found = cardEstimate(state);
  // The range is the estimate's first line; the language only changes its words, never its key.
  const range = found && estimateLines(state.config.own, found)[0]?.key;
  const from = range ? lines.findIndex((l) => l.key === range) : -1;
  return found && from > 0 ? { found, from } : undefined;
}

/**
 * The going rate under the price question (W3): the range in words over the band, then what it rests on and the
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
 * it: the going rate's card under a price question, the lock badge under the private one, the picture chips, Use my
 * location under the area, and at the summary the card face above it all (W5). There the dock asks to put it on the
 * board, so the yes and no chips stand aside.
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
  const secret = lines.some((l) => l.key === MIN_QUESTION) || asked?.secret === true;
  const draft = live?.slot === Slot.confirm ? draftOf(live) : undefined;
  const face = draft && draftCard(account, draft, lang);
  return (
    <>
      {draft && face && <CardFace card={face} km={radiusOf(account, draft)} />}
      <Ask lines={lines} split={band?.from}>
        {band && <RateCard found={band.found} lines={lines.slice(band.from)} />}
        {secret && (
          <span className="iv-private">
            <Badge icon="lock" tone={BadgeTone.green}>
              {t("cardflow.private")}
            </Badge>
          </span>
        )}
        {live && asked && (
          <Choices choices={readyToPublish(live) ? [] : choices} picked={asked.picked} say={sayChip(live, asked)} />
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
