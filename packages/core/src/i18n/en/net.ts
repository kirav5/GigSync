/** What the app says while it waits, and when the server does not answer or the phone has no internet. */
export const net = {
  "busy.working": "Working…",
  "busy.sending": "Sending…",
  "net.timeout": "GigSync didn't answer. Check your internet and try again.",
  "net.no_internet": "You're offline. Try again when you have internet.",
  "net.too_many": "Too many tries. Wait a minute and try again.",
} as const;
