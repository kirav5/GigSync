import type { MessageKey } from "@gigsync/core";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { markExplained, Permission } from "../adapters/permissions.js";
import { listenState, VoiceState } from "../adapters/speech.js";
import { useSpeechState } from "../adapters/speech-watch.js";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";
import { Icon, type IconName } from "./Icon.js";
import "./permission.css";

const ICON: Readonly<Record<Permission, IconName>> = { [Permission.mic]: "mic", [Permission.camera]: "camera" };
const TITLE: Readonly<Record<Permission, MessageKey>> = {
  [Permission.mic]: "start.mic_title",
  [Permission.camera]: "start.camera_title",
};
/** Saying no to the mic is typing instead; to the camera, it is only not now. */
const DECLINE: Readonly<Record<Permission, MessageKey>> = {
  [Permission.mic]: "start.type_instead",
  [Permission.camera]: "perm.not_now",
};

/**
 * Why GigSync needs the microphone or the camera, in the app's language, just before the phone's own prompt (which is
 * in the phone's language): the whole screen, one permission, the reason first. Allow remembers it was said and lets
 * the caller ask the phone; the other button leaves the phone's prompt for later. Drawn on <body>, so a screen still
 * easing in (motion.css moves it) cannot carry the sheet with it.
 */
export function PermissionSheet({ permission, onAnswer }: { permission: Permission; onAnswer: (go: boolean) => void }) {
  const { t } = useI18n();
  const id = useId();
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => go.current?.focus(), []);
  return createPortal(
    <div className="perm-sheet" role="dialog" aria-modal="true" aria-labelledby={id} aria-describedby={`${id}-why`}>
      <div className="perm-main">
        <span className="perm-icon" aria-hidden="true">
          <Icon name={ICON[permission]} size={56} />
        </span>
        <h2 id={id} className="hero-title">
          {t(TITLE[permission])}
        </h2>
        <p id={`${id}-why`} className="perm-why">
          {permission === Permission.mic ? <MicWhy /> : t("start.camera_body")} {t("start.phone_asks")}
        </p>
      </div>
      <div className="perm-actions">
        <button
          ref={go}
          type={C.button}
          className={`${C.wide} btn-big`}
          onClick={() => {
            void markExplained(permission);
            onAnswer(true);
          }}
        >
          {t("start.allow")}
        </button>
        <button type={C.button} className="btn ghost" onClick={() => onAnswer(false)}>
          {t(DECLINE[permission])}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Where the words are made, only once it is known: on this phone, or by the company the owner allowed (ADR 0023). The
 * Composer opens this sheet only for a recognizer it may use, so either line is true when it shows.
 */
function MicWhy() {
  const { lang, t } = useI18n();
  const [status] = useSpeechState(lang, listenState);
  const vendor = status?.cloud?.vendor;
  const body = t("start.mic_body");
  if (status?.state === VoiceState.available) return `${body} ${t("start.mic_on_phone")}`;
  if (vendor) return `${body} ${t("start.mic_by_vendor", { vendor: t(`speech.vendor_${vendor}`) })}`;
  return body;
}
