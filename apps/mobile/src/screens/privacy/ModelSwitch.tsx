import type { Ports } from "@gigsync/core";
import { ModelChoice, useChosenModel } from "../../adapters/model.js";
import { useI18n } from "../../i18n.js";
import { ToggleRow } from "../pages/ToggleRow.js";

/**
 * "Let GigSync's model read my chats" (design P3): the same choice as Settings' model, said as a switch. On is Auto,
 * the default (ADR 0052 §3), where GigSync's model is asked first; off is lite mode, where rules, templates and the
 * understanding pack on the phone do every job. The words under it are the ones ADR 0052 asks Privacy to say: the words are
 * read, not kept, and private answers never leave the phone.
 */
export function ModelSwitch({ ports }: { ports: Ports }) {
  const { t } = useI18n();
  const model = useChosenModel();
  const on = model.current.choice === ModelChoice.auto;
  const choose = (next: boolean) =>
    void model.save(ports.storage, { ...model.current, choice: next ? ModelChoice.auto : ModelChoice.lite });
  const title = t("page.privacy_model_title");
  return (
    <section aria-label={title}>
      <ToggleRow title={t("me.model_switch")} sub={t("page.privacy_model_about")} checked={on} onChange={choose} />
    </section>
  );
}
