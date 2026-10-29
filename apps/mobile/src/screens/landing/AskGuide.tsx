import { askGuide, FoundBy, type GuideAnswer, log, type Model } from "@gigsync/core";
import type { CityGuide } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { Composer } from "../../ui/Composer.js";
import { C } from "../../ui/cls.js";
import { Dock } from "../../ui/Dock.js";
import { SectionView } from "./SectionView.js";

/** A question asked and what the guide had for it. */
interface Asked {
  question: string;
  answer: GuideAnswer;
}

/** The latest answer, or that the guide has nothing on it and where to turn instead. */
function GuideAnswerView({ asked }: { asked: Asked }) {
  const { t } = useI18n();
  const { answer } = asked;
  return (
    <section className={C.card} aria-label={t("landing.ask_title")} aria-live="polite">
      <span className={C.muted}>{t("landing.you_asked", { question: asked.question })}</span>
      {answer ? (
        <>
          <SectionView section={answer.section} />
          {answer.by === FoundBy.model && <span className={C.faint}>{t("landing.by_model")}</span>}
        </>
      ) : (
        <>
          <p>{t("landing.no_answer")}</p>
          <span className={C.muted}>{t("landing.no_answer_next")}</span>
        </>
      )}
    </section>
  );
}

/**
 * "Ask the guide", by voice or typing as in Talk: the composer sits in the dock, and the answer shows at the top of
 * the screen as the guide wrote it, with its sources. No match says so and points to the numbers and mentors below.
 */
export function AskGuide({ guide, model }: { guide: CityGuide; model: Model }) {
  const { lang, t } = useI18n();
  const [asked, setAsked] = useState<Asked>();
  const [busy, setBusy] = useState(false);

  async function ask(question: string) {
    setBusy(true);
    try {
      setAsked({ question, answer: await askGuide(guide, question, { lang, model }) });
    } catch (err) {
      log.warn("asking the guide failed", { error: err instanceof Error ? err.message : String(err) });
      setAsked({ question, answer: undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {asked ? <GuideAnswerView asked={asked} /> : <span className={C.muted}>{t("landing.ask_hint")}</span>}
      <Dock>
        <Composer
          label={t("landing.ask_title")}
          placeholder={t("landing.ask_placeholder")}
          onSend={(text) => void ask(text)}
          busy={busy}
        />
      </Dock>
    </>
  );
}
