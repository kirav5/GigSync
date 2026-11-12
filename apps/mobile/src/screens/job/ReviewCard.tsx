import { type FormEvent, useId, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { J } from "./look.js";

/** The most stars, and where the choice starts: a household changes it only when it went less well. */
const MAX_STARS = 5;
const STARS = Array.from({ length: MAX_STARS }, (_, i) => i + 1);
const TEXT_FIELD = "text";
const STARS_FIELD = "stars";
const STAR_ICON = 30;

interface Props {
  them: string;
  /** The payment the worker confirmed, as shown ("₹450"). */
  paid: string;
  onSend: (stars: number, text: string) => void;
}

/**
 * The household's review once the work is paid and confirmed (H12, ADR 0020 amendment): five stars, five chosen to
 * start, and a line of words. The stars go on the worker's record; the words go only to the worker's phone, so the
 * line says so rather than calling them part of a record.
 */
export function ReviewCard({ them, paid, onSend }: Props) {
  const { t } = useI18n();
  const lineId = useId();
  const [stars, setStars] = useState(MAX_STARS);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSend(stars, String(new FormData(e.currentTarget).get(TEXT_FIELD) ?? "").trim());
  }
  return (
    <form className={`${C.stack} review-card`} onSubmit={submit} aria-label={t("a11y.review")}>
      <div className={J.sage}>
        <strong className="paid-line">{t("jobcard.paid_confirmed", { price: paid, name: them })}</strong>
        <span className={J.fine}>{t("jobcard.paid_saved")}</span>
      </div>
      <p className={J.heroLine}>{t("jobcard.how_went")}</p>
      {/* Real radio buttons under the stars: the arrow keys and a screen reader work as in any choice of one. */}
      <div className="stars" role="radiogroup" aria-label={t("a11y.stars")}>
        {STARS.map((n) => (
          <label key={n} className={n <= stars ? "star on" : "star"}>
            <input
              type="radio"
              name={STARS_FIELD}
              value={n}
              checked={n === stars}
              aria-label={t("jobcard.star", { count: n, max: MAX_STARS })}
              onChange={() => setStars(n)}
            />
            <Icon name="star" size={STAR_ICON} />
          </label>
        ))}
      </div>
      <p className={J.fine} id={lineId}>
        {t("jobcard.review_line", { name: them })}
      </p>
      <input
        className={C.field}
        name={TEXT_FIELD}
        aria-label={t("a11y.review_text")}
        aria-describedby={lineId}
        placeholder={t("job.review_placeholder")}
      />
      <button type={C.submit} className={J.hero}>
        {t("job.send_review")}
      </button>
    </form>
  );
}
