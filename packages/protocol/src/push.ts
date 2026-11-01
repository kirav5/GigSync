import { z } from "zod";

/**
 * Web Push wake-ups for job news: a device tells the API where its browser's push service reaches it, and the API
 * sends an empty push there when a job message lands in its mailbox. The push carries nothing; the phone opens its
 * own messages. Only the big browsers' push services are accepted, so the API never sends to an address of anyone's
 * choosing.
 */

/** Longest push address the API keeps; real ones run to about 200 characters. */
export const PUSH_ENDPOINT_MAX = 1024;

/** The push services of Chrome, Firefox, Safari and Edge, by host or the end of their host name. */
export const PUSH_HOSTS: readonly string[] = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  ".push.apple.com",
  ".notify.windows.com",
];

const HTTPS = "https:";

/** A push address on one of the known services, over HTTPS. */
export function isPushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname;
  return url.protocol === HTTPS && PUSH_HOSTS.some((h) => (h.startsWith(".") ? host.endsWith(h) : host === h));
}

/** `PUT /devices/me/push`: where this device's browser takes pushes. */
export const PushSubscribe = z.object({
  endpoint: z.string().max(PUSH_ENDPOINT_MAX).refine(isPushEndpoint, "not a known push service"),
});
export type PushSubscribe = z.infer<typeof PushSubscribe>;

/** `GET /devices/push-key`: the API's public VAPID key, for the browser to subscribe with. Absent: push is off. */
export const PushKey = z.object({ public_key: z.string().min(1).max(200).optional() });
export type PushKey = z.infer<typeof PushKey>;
