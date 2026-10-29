import { daysLeft, type MentorLink } from "@gigsync/core";
import { MentorRole } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import "./mentor.css";

/**
 * On a mentor link: who the other person is to this owner (their mentor, or someone new to the city) and the days
 * left before it closes, plus the vouched badge where a union or NGO vouches for the mentor.
 */
export function LinkChip({ link, now }: { link: MentorLink; now: Date }) {
  const { t, plural } = useI18n();
  if (!link.expires_at) return null;
  // This owner is the newcomer: the other person is their mentor.
  const theyMentor = link.mentor?.role === MentorRole.enum.newcomer;
  const vouched = link.mentor?.vouched_by;
  return (
    <span className="mentor-chips">
      <span className={C.chip}>{t(theyMentor ? "mentor.chip" : "mentor.chip_newcomer")}</span>
      <span className={C.faint}>{plural("mentor.days_left", daysLeft(link.expires_at, now))}</span>
      {vouched && <span className="mentor-vouched">{t("mentor.vouched", { name: vouched })}</span>}
    </span>
  );
}
