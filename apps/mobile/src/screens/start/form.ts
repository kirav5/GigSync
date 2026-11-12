import { OtpVerify } from "@gigsync/protocol";

/** The sign-in form's steps, one screen each: who you are, your number, the code from the SMS. */
export const Step = { role: "role", number: "number", code: "code" } as const;
export type Step = (typeof Step)[keyof typeof Step];

/** Ties the dock's buttons, outside the form, to it. */
export const FORM_ID = "signin";
/** The form's field names. */
export const Field = { name: "name", phone: "phone", code: "code" } as const;
/** The code the development API accepts, shown only in dev builds. */
export const DEV_CODE = "000000";
/** How many numbers the SMS code has: the length the server checks it against. */
export const CODE_LENGTH = OtpVerify.shape.code.maxLength ?? DEV_CODE.length;
