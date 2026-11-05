import { type FormEvent, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { errorKey } from "../../ui/errorKey.js";
import { Working } from "../../ui/Working.js";

/** The note field's name in its form. */
const NOTE_FIELD = "note";

/** The worker's own words to the customer, sent as written and tagged with this phone's language. */
export function NoteBox({ onSend }: { onSend: (text: string) => Promise<unknown> }) {
  const { t } = useI18n();
  const [sending, setSending] = useState(0);
  const [failed, setFailed] = useState<string>();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const field = form.elements.namedItem(NOTE_FIELD);
    const text = String(new FormData(form).get(NOTE_FIELD) ?? "").trim();
    if (!text) return;
    // Cleared at once, not when the send finishes: that would wipe a next note typed meanwhile. Sends queue in order;
    // a failed one puts its words back if the box is still empty.
    form.reset();
    setFailed(undefined);
    setSending((n) => n + 1);
    void onSend(text)
      .catch((err: unknown) => {
        if (field instanceof HTMLInputElement && !field.value) field.value = text;
        setFailed(t(errorKey(err)));
      })
      .finally(() => setSending((n) => n - 1));
  }
  return (
    <form className={C.row} onSubmit={submit} aria-label={t("a11y.note")}>
      <input
        className={C.field}
        name={NOTE_FIELD}
        aria-label={t("a11y.note")}
        placeholder={t("job.note_placeholder")}
      />
      <button type={C.submit} className={C.btn}>
        {t("job.send_note")}
      </button>
      <Working on={sending > 0} words={t("busy.sending")} />
      {failed && <p className={C.error}>{failed}</p>}
    </form>
  );
}
