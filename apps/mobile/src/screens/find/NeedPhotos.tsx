import { canAddPhoto, log, type NeedState } from "@gigsync/core";
import { type ReactNode, useRef, useState } from "react";
import { nativePicker, PhotoError, pickPhoto, shrinkPhoto } from "../../adapters/photo.js";
import { needPhotoAdded, needPhotoRemoved } from "../../find/needPhotos.js";
import { useI18n } from "../../i18n.js";
import type { ComposerPick } from "../../ui/ComposerMore.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import "./photos.css";

/** Pictures only, from the camera or the gallery, as the phone offers them. */
const IMAGES = "image/*";

/**
 * Photos of the job in the Find chat (ADR 0066): the composer's "+" is "Add a photo", as in WhatsApp or ChatGPT: in the
 * app it opens the phone's own sheet (take a photo, or choose from the gallery), in a browser the file picker. Each
 * picked photo is shrunk on the phone and shown as a small tile above the composer, with a cross
 * to take it off. They go with the request when the workers are asked.
 */
export function useNeedPhotos(chat: string, state: NeedState | undefined): { picks: ComposerPick[]; strip: ReactNode } {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string>();
  const [adding, setAdding] = useState(false);
  // Until the workers are asked, when the chat's need is gone (sent), a photo can be added at any turn.
  const open = state !== undefined;
  const photos = state?.photos ?? [];

  async function picked(file: Blob | undefined) {
    if (!file) return;
    setAdding(true);
    try {
      needPhotoAdded(chat, await shrinkPhoto(file));
      setProblem(undefined);
    } catch (err) {
      log.warn("photo not added", { error: err instanceof Error ? err.name : typeof err });
      setProblem(t(err instanceof PhotoError ? "photo.failed" : "error.generic"));
    } finally {
      setAdding(false);
    }
  }

  const strip = open && (
    <>
      <input
        ref={input}
        type="file"
        accept={IMAGES}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          void picked(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      {(photos.length > 0 || adding || problem) && (
        <ul className="need-photos" aria-label={t("photo.list")}>
          {photos.map((src, i) => (
            // The same picture may be added twice, so a tile is told by its place; the tiles hold no state, and the
            // list changes only as a whole when one is taken off.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <li key={i} className="need-photo">
              <img src={src} alt={t("photo.alt", { n: i + 1 })} />
              <button
                type={C.button}
                className="need-photo-remove"
                aria-label={t("photo.remove", { n: i + 1 })}
                onClick={() => needPhotoRemoved(chat, i)}
              >
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
          {adding && <li className="need-photo need-photo-wait" aria-label={t("photo.adding")} />}
          {problem && (
            <li className={C.error} role="alert">
              {problem}
            </li>
          )}
        </ul>
      )}
    </>
  );
  const choose = () =>
    nativePicker()
      ? void pickPhoto({
          title: t("photo.add"),
          camera: t("photo.camera"),
          gallery: t("photo.gallery"),
          cancel: t("mentor.cancel"),
        }).then(picked)
      : input.current?.click();
  const pick: ComposerPick | undefined =
    open && canAddPhoto(state) ? { icon: "camera", label: t("photo.add"), onPick: choose } : undefined;
  return { picks: pick ? [pick] : [], strip };
}
