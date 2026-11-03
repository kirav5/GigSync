import { readSkill } from "@gigsync/core";
import { MAX_SKILLS, MAX_TRADES, SKILL_MAX, type Skill, skillKey, type Trade } from "@gigsync/protocol";
import { type KeyboardEvent, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

const ENTER = "Enter";

/**
 * Work outside the trades, in the worker's own words (ADR 0047): typed, checked on the phone with the board's own
 * rules, and listed as chips to remove. Words that are clearly a trade ("bijli ka kaam") pick that trade instead, so
 * the card keeps its prices and questions.
 */
export function SkillsField({
  skills,
  trades,
  onChange,
  onTrade,
}: {
  skills: readonly Skill[];
  trades: readonly Trade[];
  onChange: (skills: Skill[]) => void;
  /** The words named a trade: it is picked on the card. */
  onTrade: (trade: Trade) => void;
}) {
  const { lang, t } = useI18n();
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState<string>();

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
      {note && (
        <p className={C.muted} role="status">
          {note}
        </p>
      )}
    </>
  );
}
