import type { MessageKey } from "@gigsync/core";
import { useEffect, useRef } from "react";
import { markExplained, Permission } from "../adapters/permissions.js";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";

const WHY: Readonly<Record<Permission, MessageKey>> = {
  [Permission.mic]: "perm.mic_why",
  [Permission.camera]: "qr.camera_why",
};

/**
 * Why GigSync needs the microphone or the camera, in the app's language, just before the phone's own prompt. Continue
 * remembers it was said and lets the caller ask the phone; Not now leaves the phone's prompt for later.
 */
export function PermissionSheet({ permission, onAnswer }: { permission: Permission; onAnswer: (go: boolean) => void }) {
  const { t } = useI18n();
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => go.current?.focus(), []);
  return (
    <div className={C.card} role="dialog" aria-label={t(WHY[permission])}>
      <p>{t(WHY[permission])}</p>
      <div className={C.actions}>
        <button
          ref={go}
          type={C.button}
          className={C.accent}
          onClick={() => {
            void markExplained(permission);
            onAnswer(true);
          }}
        >
          {t("perm.continue")}
        </button>
        <button type={C.button} className={C.secondary} onClick={() => onAnswer(false)}>
          {t("perm.not_now")}
        </button>
      </div>
    </div>
  );
}
