import { Header } from "@gigsync/core";

/** Every API call the simulated phones make, timed, by route. */
export interface Hit {
  /** Milliseconds from the start of the step. */
  at: number;
  route: string;
  status: number;
  ms: number;
  error?: string;
}

/** Path segments that name one thing (a user, an engagement, a message), so calls group by route. */
const ID_SEGMENT = /^(?:(?:[a-z]{2,4}_)?[0-9A-HJKMNP-TV-Z]{26}|[0-9a-f-]{32,36}|did:[^/]+|\d+)$/i;
const IP_OCTET = 250;

/** `GET /v1/board/workers` from a full URL: the method, then the path with ids replaced by `:id`. */
export function routeOf(method: string, url: string): string {
  const path = new URL(url).pathname
    .split("/")
    .map((s) => (ID_SEGMENT.test(s) ? ":id" : s))
    .join("/");
  return `${method} ${path}`;
}

const randomIp = () =>
  `10.${Math.floor(Math.random() * IP_OCTET)}.${Math.floor(Math.random() * IP_OCTET)}.${Math.floor(Math.random() * IP_OCTET)}`;

/**
 * A `fetch` for one simulated phone that records each call into `hits`. Locally wrangler takes the client's address
 * from CF-Connecting-IP, so each phone gets its own, as it would in the field; a deployed API ignores the header.
 */
export function meteredFetch(hits: Hit[], stepStart: () => number): typeof fetch {
  const ip = randomIp();
  return async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const headers = { ...(init?.headers as Record<string, string>), [Header.cfConnectingIp]: ip };
    const started = performance.now();
    const at = Math.round(started - stepStart());
    try {
      const res = await fetch(input, { ...init, headers });
      // The body is read by the caller; time to headers is what the server spent plus the network.
      hits.push({ at, route: routeOf(method, url), status: res.status, ms: Math.round(performance.now() - started) });
      return res;
    } catch (err) {
      const error = err instanceof Error ? err.name : typeof err;
      hits.push({ at, route: routeOf(method, url), status: 0, ms: Math.round(performance.now() - started), error });
      throw err;
    }
  };
}
