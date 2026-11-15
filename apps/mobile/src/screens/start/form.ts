/**
 * The sign-in form's steps, one screen each, in order: the welcome, the number, the code from the SMS, then, only for a
 * number this phone keeps nothing for, find work or find help and the name.
 */
export const Step = { welcome: "welcome", number: "number", code: "code", role: "role", name: "name" } as const;
export type Step = (typeof Step)[keyof typeof Step];

/** Ties the dock's buttons, outside the form, to it. */
export const FORM_ID = "signin";
/** The form's field names. */
export const Field = { name: "name", phone: "phone", code: "code" } as const;
export { CODE_LENGTH, DEV_CODE } from "../../ui/CodeBoxes.js";
