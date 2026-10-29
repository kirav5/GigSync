import type { GigDevice, ListingChoices, MentorChoices, MentorRecord, MessageKey } from "@gigsync/core";
import { City, DEFAULT_MENTOR_SLOTS, Lang, MENTOR_MIN_JOBS, MENTOR_MIN_MONTHS, type Trade } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { AREAS } from "../../ui/places.js";
import { CheckRow } from "./CheckRow.js";
import { ChipPick } from "./ChipPick.js";
import { mentorProblem } from "./problems.js";

/** How many newcomers at a time a mentor may choose from. */
const SLOT_CHOICES = [1, 2, 3, 4, 5] as const;

interface Props {
  account: Account;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Opens Find a mentor, for a worker who is moving themselves. */
  onFind: () => void;
}

/** The owner's earlier choices, or a start from their card: first name, its area, trades and languages. */
function startingChoices(account: Account, lang: Lang, saved: MentorChoices | undefined): ListingChoices {
  if (saved) return saved;
  const base = account.worker?.base;
  const area = AREAS.find((a) => a.lat === base?.lat && a.lon === base?.lon) ?? AREAS[0];
  return {
    first_name: account.contact.name.split(" ")[0] ?? account.contact.name,
    city: City.enum.bengaluru,
    area: area.name,
    trades: account.worker?.trades ?? [],
    languages: account.languages ?? [lang],
    woman: false,
    women_only_newcomers: false,
    slots: DEFAULT_MENTOR_SLOTS,
  };
}

const toggle = <T,>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/**
 * Profile's "I can help people new to {city}": off, with the reason, until this phone's own record shows the minimum
 * months and jobs both sides signed; then the choices newcomers will see, and switching it on or off. Nobody approves
 * it: the record on the phone is the rule.
 */
export function MentorSection({ account, device, run, onFind }: Props) {
  const { lang, t } = useI18n();
  const [record, setRecord] = useState<MentorRecord>();
  const [choices, setChoices] = useState<ListingChoices>();
  const [listed, setListed] = useState(false);
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<MessageKey>();

  useEffect(() => {
    void Promise.all([device.mentors.record(), device.mentors.choices()]).then(([r, saved]) => {
      setRecord(r);
      setChoices(startingChoices(account, lang, saved));
      setListed(saved?.listed ?? false);
    });
  }, [device, account, lang]);

  if (!record || !choices) return null;
  const city = t(`mentor.city.${choices.city}`);
  const title = t("mentor.offer_title");
  const set = (change: Partial<ListingChoices>) => setChoices({ ...choices, ...change });

  async function save(on: boolean) {
    setProblem(undefined);
    try {
      if (on && choices) await run(() => device.mentors.publish(choices));
      else await run(() => device.mentors.unpublish());
      setListed(on);
      setOpen(false);
    } catch (err) {
      setProblem(mentorProblem("mentor listing failed", err));
    }
  }

  const minimum = {
    min_months: MENTOR_MIN_MONTHS,
    min_jobs: MENTOR_MIN_JOBS,
    jobs: record.jobs,
    months: record.months,
  };
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <CheckRow
        checked={listed || open}
        disabled={!record.eligible}
        onChange={(on) => (on ? setOpen(true) : void save(false))}
      >
        {t("mentor.offer_toggle", { city })}
      </CheckRow>
      {!record.eligible && <span className={C.muted}>{t("mentor.not_yet", minimum)}</span>}
      {listed && !open && <span role="status">{t("mentor.listed", { city })}</span>}
      {open && (
        <div className={C.stack}>
          <span className={C.muted}>{t("mentor.offer_about")}</span>
          <ChipPick
            label={t("mentor.area")}
            options={AREAS.map((a) => ({ value: a.name, text: t(`area.${a.key}`) }))}
            chosen={[choices.area]}
            onPick={(area) => set({ area })}
          />
          <ChipPick
            label={t("mentor.trades")}
            options={(account.worker?.trades ?? []).map((tr: Trade) => ({ value: tr, text: t(`trade.${tr}`) }))}
            chosen={choices.trades}
            onPick={(tr) => set({ trades: toggle(choices.trades, tr) })}
          />
          <ChipPick
            label={t("mentor.languages")}
            options={Lang.options.map((l) => ({ value: l, text: t(`lang.${l}`) }))}
            chosen={choices.languages}
            onPick={(l) => set({ languages: toggle(choices.languages, l) })}
          />
          <CheckRow checked={choices.woman} onChange={(woman) => set({ woman })}>
            {t("mentor.i_am_woman")}
          </CheckRow>
          <span className={C.faint}>{t("mentor.woman_why")}</span>
          {choices.woman && (
            <CheckRow
              checked={choices.women_only_newcomers}
              onChange={(women_only_newcomers) => set({ women_only_newcomers })}
            >
              {t("mentor.only_women")}
            </CheckRow>
          )}
          <ChipPick
            label={t("mentor.slots")}
            options={SLOT_CHOICES.map((n) => ({ value: n, text: String(n) }))}
            chosen={[choices.slots]}
            onPick={(slots) => set({ slots })}
          />
          <div className={C.actions}>
            <button
              type={C.button}
              className={C.accent}
              disabled={choices.trades.length === 0 || choices.languages.length === 0}
              onClick={() => void save(true)}
            >
              {t("mentor.publish")}
            </button>
          </div>
        </div>
      )}
      {problem && <p className={C.error}>{t(problem, { ...minimum, name: "" })}</p>}
      <div className={C.actions}>
        <button type={C.button} className={C.secondary} onClick={onFind}>
          {t("mentor.find")}
        </button>
      </div>
    </section>
  );
}
