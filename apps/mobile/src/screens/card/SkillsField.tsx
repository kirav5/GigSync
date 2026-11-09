import { readSkill, type WorkMatch, workMatchName } from "@gigsync/core";
import { MAX_SKILLS, MAX_TRADES, SKILL_MAX, type Skill, skillKey, type Trade } from "@gigsync/protocol";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

const ENTER = "Enter";

/**
 * Work outside the trades, in the worker's own words (ADR 0047): typed, checked on the phone with the board's own
 * rules, and listed as chips to remove. Words that are clearly a trade ("bijli ka kaam") pick that trade instead, so
 * the card keeps its prices and questions. A skill that is neither is asked about once (ADR 0059): the model suggests a
 * trade or a kind of work, and only the worker's yes sets it.
 */
export function SkillsField({
  suggest,
  skills,
  trades,
  onChange,
  onTrade,
  onFiled,
}: {
  /** What the words might be, from the model; undefined with none, or when nothing fits. */
  suggest: (words: string) => Promise<WorkMatch | undefined>;
  skills: readonly Skill[];
  trades: readonly Trade[];
  onChange: (skills: Skill[]) => void;
  /** The words named a trade: it is picked on the card. */
  onTrade: (trade: Trade) => void;
  /** A yes filed a skill already on the card: the card's work as it now is, to save at once. */
  onFiled?: (work: { trades: Trade[]; skills: Skill[] }) => void;
}) {
  const { lang, t } = useI18n();
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState<string>();
  const [asking, setAsking] = useState<{ skill: Skill; match: WorkMatch }>();

  /** Skills asked about while this screen is open: one answered no is not asked again until the next visit. */
  const asked = useRef(new Set<string>());

  async function ask(skill: Skill) {
    asked.current.add(skillKey(skill.text));
    const match = await suggest(skill.text);
    if (match) setAsking({ skill, match });
  }

  // A skill on the card from before kinds of work (ADR 0059), or said in the interview, is asked about here too.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one question at a time, as the skills change
  useEffect(() => {
    if (asking) return;
    const next = skills.find((s) => !s.category && !asked.current.has(skillKey(s.text)));
    if (next) void ask(next);
  }, [skills, asking]);

  function answer(yes: boolean) {
    if (!asking) return;
    const { skill, match } = asking;
    setAsking(undefined);
    if (!yes) return;
    const others = skills.filter((s) => s.text !== skill.text);
    const filed =
      "category" in match
        ? { trades: [...trades], skills: [...others, { ...skill, category: match.category }] }
        : { trades: trades.includes(match.trade) ? [...trades] : [...trades, match.trade], skills: others };
    onChange(filed.skills);
    if ("trade" in match && !trades.includes(match.trade)) onTrade(match.trade);
    onFiled?.(filed);
  }

  function add() {
    if (!typed.trim()) return;
    const read = readSkill(typed, lang);
    if ("problem" in read) return setNote(t(`skill.err.${read.problem}`));
    setTyped("");
    if ("trade" in read) {
      if (!trades.includes(read.trade)) onTrade(read.trade);
      return setNote(t("skill.is_trade", { trade: t(`trade.${read.trade}`) }));
    }
    const key = skillKey(read.skill.text);
    if (skills.some((s) => skillKey(s.text) === key)) return setNote(undefined);
    if (skills.length >= MAX_SKILLS || trades.length + skills.length >= MAX_TRADES)
      return setNote(t("skill.err.too_many", { max: MAX_SKILLS }));
    setNote(undefined);
    onChange([...skills, read.skill]);
    if (!read.skill.category) void ask(read.skill);
  }

  // Enter adds the skill; it must not submit (publish) the card around it.
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== ENTER) return;
    e.preventDefault();
    add();
  };

  return (
    <>
      <label className={C.fieldLabel}>
        <span className={C.muted}>{t("card.skill_label")}</span>
        <input
          className={C.field}
          value={typed}
          maxLength={SKILL_MAX}
          placeholder={t("card.skill_example")}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={onKey}
        />
      </label>
      <div className={C.row}>
        <button type={C.button} className={C.secondary} onClick={add}>
          {t("card.skill_add")}
        </button>
        {skills.map((s) => (
          <button
            key={s.text}
            type={C.button}
            lang={s.lang}
            aria-pressed={true}
            aria-label={t("card.skill_remove", { skill: s.text })}
            className={C.chipOn}
            onClick={() => onChange(skills.filter((x) => x !== s))}
          >
            {s.text} ×
          </button>
        ))}
      </div>
      {asking && skills.some((s) => s.text === asking.skill.text) && (
        <>
          <p role="status">{t("skill.is_work", { work: workMatchName(lang, asking.match) })}</p>
          <div className={C.row}>
            <button type={C.button} className={C.secondary} onClick={() => answer(true)}>
              {t("flag.yes")}
            </button>
            <button type={C.button} className={C.secondary} onClick={() => answer(false)}>
              {t("flag.no")}
            </button>
          </div>
        </>
      )}
      {note && (
        <p className={C.muted} role="status">
          {note}
        </p>
      )}
    </>
  );
}
