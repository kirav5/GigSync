import type { MessageKey } from "@gigsync/core";
import type { JobPhoto } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Sheet } from "../../ui/Sheet.js";
import "../find/photos.css";

/** Each photo's name: "Photo 1 of the job". */
const ALT: MessageKey = "photo.alt";

/**
 * The photos the household sent with the request (ADR 0066), on the job for both sides: tiles under the need, each
 * opening full size in a sheet. They are on these two phones only.
 */
export function JobPhotos({ photos }: { photos: readonly JobPhoto[] | undefined }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<number>();
  if (!photos?.length) return null;
  const shown = open === undefined ? undefined : photos[open];
  return (
    <>
      <ul className="job-photos" aria-label={t("photo.list")}>
        {photos.map((src, i) => (
          // The photos of a sent request never change, and the same picture may be there twice.
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
          <li key={i}>
            <button type={C.button} className="job-photo" onClick={() => setOpen(i)}>
              <img src={src} alt={t(ALT, { n: i + 1 })} />
            </button>
          </li>
        ))}
      </ul>
      {shown && open !== undefined && (
        <Sheet title={t(ALT, { n: open + 1 })} done={t("profile.done")} onClose={() => setOpen(undefined)}>
          <img className="photo-full" src={shown} alt={t(ALT, { n: open + 1 })} />
        </Sheet>
      )}
    </>
  );
}
