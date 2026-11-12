import type { LoadedGuide } from "@gigsync/core";
import { GuideStatus } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { GuideText } from "./SectionView.js";
import "./landing.css";

/**
 * The label every screen showing the guide carries: the app's own words for a draft, else the guide's; and, when the
 * phone is offline, the day the copy shown was saved.
 */
export function GuideLabel({ loaded }: { loaded: LoadedGuide }) {
  const { t, date } = useI18n();
  const draft = loaded.guide.status === GuideStatus.enum.draft;
  return (
    <div className="guide-label" role="note">
      <strong>{draft ? t("landing.draft") : <GuideText text={loaded.guide.label} original={false} />}</strong>
      {loaded.offline && <span className={C.muted}>{t("landing.offline", { date: date(new Date(loaded.at)) })}</span>}
    </div>
  );
}
