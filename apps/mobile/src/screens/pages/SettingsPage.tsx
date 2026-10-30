import type { MessageKey, Ports } from "@gigsync/core";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { InstallCard, InstallPlace } from "../../ui/InstallCard.js";
import { Look, savedLook, saveLook } from "../../ui/look.js";
import { ModelSettings } from "../ModelSettings.js";
import { SpeechSettings } from "../SpeechSettings.js";
import { TacticSetting } from "../TacticSetting.js";
import { PageFrame } from "./PageFrame.js";

const LOOKS: readonly { look: Look; label: MessageKey }[] = [
  { look: Look.auto, label: "look.auto" },
  { look: Look.light, label: "look.light" },
  { look: Look.dark, label: "look.dark" },
];

/** Light, dark, or the phone's own setting. */
function LookPicker() {
  const { t } = useI18n();
  const [look, setLook] = useState<Look>(savedLook());
  const title = t("settings.look");
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <div className={C.row}>
        {LOOKS.map((l) => (
          <button
            key={l.look}
            type={C.button}
            aria-pressed={look === l.look}
            className={look === l.look ? C.chipOn : C.chip}
            onClick={() => {
              saveLook(l.look);
              setLook(l.look);
            }}
          >
            {t(l.label)}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * Settings, as collab's: the look, voice actions (workers), the model on this phone, how the agent bargains, and
 * installing the web app. Each saves as it changes, on this phone.
 */
export function SettingsPage({ ports, isWorker }: { ports: Ports; isWorker: boolean }) {
  const { lang, t } = useI18n();
  return (
    <PageFrame title={t("page.settings_title")} subtitle={t("page.settings_soft")}>
      <LookPicker />
      {isWorker && <SpeechSettings />}
      <ModelSettings ports={ports} />
      <TacticSetting ports={ports} />
      <InstallCard place={InstallPlace.settings} lang={lang} />
    </PageFrame>
  );
}
