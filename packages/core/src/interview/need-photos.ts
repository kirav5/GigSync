import { type JobPhoto, MAX_PHOTOS } from "@gigsync/protocol";
import type { NeedState } from "./need.js";

/** The need with one more photo of the job (ADR 0066); past `MAX_PHOTOS` it stays as it was. */
export function needWithPhoto(s: NeedState, photo: JobPhoto): NeedState {
  const photos = s.photos ?? [];
  return photos.length >= MAX_PHOTOS ? s : { ...s, photos: [...photos, photo] };
}

/** The need without the photo at `index`. */
export function needWithoutPhoto(s: NeedState, index: number): NeedState {
  const photos = (s.photos ?? []).filter((_, i) => i !== index);
  const { photos: _was, ...rest } = s;
  return photos.length > 0 ? { ...rest, photos } : rest;
}

/** Whether the owner may add another photo now. */
export const canAddPhoto = (s: NeedState | undefined): boolean => (s?.photos?.length ?? 0) < MAX_PHOTOS;
