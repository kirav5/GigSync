import type { GigDevice, MessageKey, Ports } from "@gigsync/core";
import { Lang, PAYEE_NAME_MAX, type UserId } from "@gigsync/protocol";
import { useState } from "react";
import type { Account } from "../adapters/account.js";
import { useI18n } from "../i18n.js";
import { PayeeForm } from "../payments/PayeeForm.js";
import { C } from "../ui/cls.js";
import { InstallCard, InstallPlace } from "../ui/InstallCard.js";
import { Look, savedLook, saveLook } from "../ui/look.js";
import { AREAS, money } from "../ui/places.js";
import { ShareSetting } from "./estimate/ShareSetting.js";
import { MovingEntry } from "./landing/MovingEntry.js";
import { ModelSettings } from "./ModelSettings.js";
import { MemorySection } from "./memory/MemorySection.js";
import { LinksSection } from "./mentor/LinksSection.js";
import { MentorSection } from "./mentor/MentorSection.js";
import { SpeechSettings } from "./SpeechSettings.js";
import { TacticSetting } from "./TacticSetting.js";

const LOOKS: readonly { look: Look; label: MessageKey }[] = [
  { look: Look.auto, label: "look.auto" },
  { look: Look.light, label: "look.light" },
  { look: Look.dark, label: "look.dark" },
];

interface Props {
  ports: Ports;
  account: Account;
  isWorker: boolean;
  onSignOut: () => void;
  /** Opens My card, the form that reviews and changes the card. */
  onCard: () => void;
  /** Opens Talk on the card interview. */
  onTalkCard: () => void;
  /** Opens one mentor link's thread. */
  onOpenLink: (user: UserId) => void;
  /** Opens the landing journey: moving to a new city. */
  onMoving: () => void;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Opens Find a mentor. */
  onFindMentor: () => void;
}

/** Profile's folds: what is not looked at every day waits behind a row. */
const FOLD = "more";

/** The worker's card at a glance: what customers see on the board, or that it is not there, and two ways to change it. */
function CardSummary({ account, onCard, onTalkCard }: Pick<Props, "account" | "onCard" | "onTalkCard">) {
  const { t } = useI18n();
  const rules = account.worker;
  const listed = rules && account.listed !== false;
  const area = rules && AREAS.find((a) => a.lat === rules.base.lat && a.lon === rules.base.lon);
  const title = t("nav.card");
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <span>
        {listed
          ? t("card.on_board", {
              trades: rules.trades.map((tr) => t(`trade.${tr}`)).join(", "),
              area: area ? t(`area.${area.key}`) : "",
              price: money(rules.rate.opening_paise),
            })
          : t("profile.card_off")}
      </span>
      <div className={C.actions}>
        <button type={C.button} className={C.accent} onClick={onTalkCard}>
          {t("profile.talk_card")}
        </button>
        <button type={C.button} className={C.secondary} onClick={onCard}>
          {title}
        </button>
      </div>
    </section>
  );
}

/** Light, dark, or the phone's own setting. */
function LookPicker() {
  const { t } = useI18n();
  const [look, setLook] = useState<Look>(savedLook());
  return (
    <div className={C.card}>
      <span className={C.label}>{t("settings.look")}</span>
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
    </div>
  );
}

/**
 * Profile, kept lean: what a person comes here for stays in view (the worker's card, the UPI ID they are paid to,
 * live mentor links, the language, installing the app); everything else waits in three folds: what the agent
 * remembers and how it bargains, moving to a new city and mentoring, and the rest (voice actions, look, model).
 * Each section saves as it changes, and everything is kept on this phone.
 */
export function Settings(props: Props) {
  const { ports, account, isWorker, onSignOut, onCard, onTalkCard, onOpenLink } = props;
  const { onMoving, device, run, onFindMentor } = props;
  const { lang, setLang, t } = useI18n();
  const name = account.contact.name;
  const role = t(isWorker ? "role.worker" : "role.customer");
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("nav.profile")}</span>
        <h1 className={C.headline}>
          {t("settings.headline")} <span className={C.soft}>{t("settings.soft")}</span>
        </h1>
        <span className={C.muted}>
          {name} · {role}
        </span>
      </div>

      {isWorker && <CardSummary account={account} onCard={onCard} onTalkCard={onTalkCard} />}
      {isWorker && <PayeeForm ports={ports} defaultName={name.slice(0, PAYEE_NAME_MAX)} />}
      {isWorker && <LinksSection onOpen={onOpenLink} />}

      <section className={C.card} aria-label={t("profile.language")}>
        <span className={C.label}>{t("profile.language")}</span>
        <fieldset className={C.row} aria-label={t("a11y.language")}>
          {Lang.options.map((l) => (
            <button
              key={l}
              type={C.button}
              lang={l}
              aria-pressed={lang === l}
              className={lang === l ? C.chipOn : C.chip}
              onClick={() => setLang(l)}
            >
              {t(`lang.${l}`)}
            </button>
          ))}
        </fieldset>
      </section>

      <InstallCard place={InstallPlace.settings} lang={lang} />

      <div className="profile-folds">
        <details className={FOLD}>
          <summary>{t("profile.agent")}</summary>
          <div className={C.stack}>
            <MemorySection ports={ports} account={account} />
            <ShareSetting ports={ports} />
            <TacticSetting ports={ports} />
          </div>
        </details>

        {isWorker && (
          <details className={FOLD}>
            <summary>{t("profile.new_city")}</summary>
            <div className={C.stack}>
              <MovingEntry onOpen={onMoving} />
              <MentorSection account={account} device={device} run={run} onFind={onFindMentor} />
            </div>
          </details>
        )}

        <details className={FOLD}>
          <summary>{t("profile.more")}</summary>
          <div className={C.stack}>
            {isWorker && <SpeechSettings />}
            <LookPicker />
            <ModelSettings ports={ports} />
          </div>
        </details>
      </div>

      <footer className="profile-foot">
        <div>
          <button type={C.button} className={C.secondary} onClick={onSignOut}>
            {t("shell.sign_out")}
          </button>
        </div>
      </footer>
    </>
  );
}
