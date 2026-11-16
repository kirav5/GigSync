import { needWithoutPhoto, needWithPhoto } from "@gigsync/core";
import type { JobPhoto } from "@gigsync/protocol";
import { changeChat } from "./findChats.js";

/** A photo of the job added in the Find chat (ADR 0066): it goes with every request this need sends. */
export function needPhotoAdded(chat: string, photo: JobPhoto): void {
  changeChat(chat, (c) => (c.need ? { ...c, need: needWithPhoto(c.need, photo) } : c));
}

/** The photo at `index` taken off the need before it was sent. */
export function needPhotoRemoved(chat: string, index: number): void {
  changeChat(chat, (c) => (c.need ? { ...c, need: needWithoutPhoto(c.need, index) } : c));
}
