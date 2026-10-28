import type { SpeechStatus } from "@gigsync/plugin-speech";
import type { Lang } from "@gigsync/protocol";
import { useState } from "react";

/**
 * Voice for the screens, in the owner's language: speech to text on the device first, a cloud recognizer only after
 * the owner allowed that vendor (ADR 0023), and reading aloud with local voices only. Until the engines are wired
 * nothing is available, so the screens offer typing and tap choices.
 */
const NONE: SpeechStatus = { state: "unavailable", engine: "none" };

export async function listenState(_lang: Lang): Promise<SpeechStatus> {
  return NONE;
}

export async function speakState(_lang: Lang): Promise<SpeechStatus> {
  return NONE;
}

/** Fetches the language's recognizer once. Only from the owner's tap. */
export async function prepareListen(_lang: Lang): Promise<SpeechStatus> {
  return NONE;
}

/** Fetches the language's voice data once. Only from the owner's tap. */
export async function prepareSpeak(_lang: Lang): Promise<SpeechStatus> {
  return NONE;
}

/** The final words heard, "" for nothing; words so far go to `onPartial`. Stops any speech first. */
export async function listen(
  _lang: Lang,
  _hints: readonly string[],
  _onPartial: (text: string) => void,
): Promise<string> {
  return "";
}

export async function stopListening(): Promise<void> {}

/** Speaks now, for the owner's explicit tap. */
export async function speak(_lang: Lang, _text: string): Promise<void> {}

/** Speaks only when reading aloud is on and a local voice exists. Never rejects. */
export async function readAloud(_lang: Lang, _text: string): Promise<void> {}

export async function canSpeak(_lang: Lang): Promise<boolean> {
  return false;
}

export async function stopSpeaking(): Promise<void> {}

/** Whether questions are read aloud; on by default. */
export function useReadAloudPref(): [boolean, (on: boolean) => void] {
  return useState(true);
}
