import type { MessageKey } from "@gigsync/core";
import { MAX_LANDING_REQUESTS } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { AREAS } from "../../ui/places.js";

/** What the newcomer adds to their request: any day of the week they arrive, an area if they know one, a note. */
export interface RequestDraft {
  arrival_week: string;
  area?: string;
  note?: string;
}

const NOTE_MAX = 300;

/**
 * The request sheet for the mentors the newcomer chose: the week they arrive, where they will stay near, a short note,
 * and Send. Nothing goes until they press it.
 */
export function RequestSheet({
  count,
  busy,
  problem,
  onSend,
}: {
  count: number;
  busy: boolean;
  problem: MessageKey | undefined;
  onSend: (draft: RequestDraft) => void;
}) {
  const { t, plural } = useI18n();
  const [arrival, setArrival] = useState("");
  const [area, setArea] = useState("");
  const [note, setNote] = useState("");
  const title = plural("mentor.ask", count);
  return (
    <form
      className={C.card}
      aria-label={title}
      onSubmit={(e) => {
        e.preventDefault();
        onSend({ arrival_week: arrival, ...(area ? { area } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
      }}
    >
      <span className={C.label}>{title}</span>
      <label className={C.field}>
        <span className={C.fieldLabel}>{t("mentor.arrival")}</span>
        <input type="date" required value={arrival} onChange={(e) => setArrival(e.target.value)} />
      </label>
      <label className={C.field}>
        <span className={C.fieldLabel}>{t("mentor.area_near")}</span>
        <select value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">—</option>
          {AREAS.map((a) => (
            <option key={a.key} value={a.name}>
              {t(`area.${a.key}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={C.field}>
        <span className={C.fieldLabel}>{t("mentor.note")}</span>
        <textarea value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
      </label>
      {problem && <p className={C.error}>{t(problem, { count: MAX_LANDING_REQUESTS, name: "" })}</p>}
      <div className={C.actions}>
        <button type={C.submit} className={C.accent} disabled={busy || !arrival} aria-busy={busy}>
          {t("mentor.send")}
        </button>
      </div>
    </form>
  );
}
