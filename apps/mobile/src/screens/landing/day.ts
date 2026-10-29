/** Midday, so a `YYYY-MM-DD` day shown in any Indian time zone is the day meant. */
const MIDDAY = "T12:00:00";

/** A `YYYY-MM-DD` day as a Date to format. */
export const dayAt = (day: string): Date => new Date(`${day}${MIDDAY}`);
