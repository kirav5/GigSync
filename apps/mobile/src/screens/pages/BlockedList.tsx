import { type BlockedPerson, type GigDevice, log } from "@gigsync/core";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import "./pages.css";

const failure = (err: unknown) => ({ error: err instanceof Error ? err.name : typeof err });

/**
 * Everyone the owner blocked (from a mentor link, an introduction or a request), newest first, by the name this phone
 * knew them by. There is no unblock: the server was told never to match the two again.
 */
export function BlockedList({ device }: { device: GigDevice }) {
  const { t, date } = useI18n();
  const [people, setPeople] = useState<BlockedPerson[]>();

  useEffect(() => {
    let live = true;
    device.mentors.blocked().then(
      (list) => live && setPeople(list),
      (err: unknown) => log.warn("blocked people not read", failure(err)),
    );
    return () => {
      live = false;
    };
  }, [device]);

  const title = t("page.blocked");
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <span className={C.muted}>{t("page.blocked_about")}</span>
      {people?.length === 0 && <span className={C.faint}>{t("page.blocked_none")}</span>}
      {people && people.length > 0 && (
        <ul className="blocked-rows">
          {people.map((p) => (
            <li key={p.user}>
              <strong>{p.name ?? t("page.blocked_unnamed")}</strong>
              <span className={C.faint}>{t("page.blocked_on", { date: date(new Date(p.at)) })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
