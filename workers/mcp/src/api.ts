import { BEARER_PREFIX, ContentType, Header, HttpMethod } from "@gigsync/core/http";
import { BoardResult, ConnectorSession, type ConnectorSignIn } from "@gigsync/protocol";

/** The API routes the connector uses (workers/api: routes/auth.ts and routes/connector.ts). */
const Route = {
  otpRequest: "/v1/auth/otp/request",
  signIn: "/v1/auth/connector",
  workers: "/v1/connector/workers",
  card: "/v1/connector/card",
  skills: "/v1/connector/skills",
} as const;

/** An API answer that was not 2xx, with the API's safe `{ error }` message. */
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiFailure";
  }
}

async function answer(res: Response): Promise<unknown> {
  const body: unknown = await res.json().catch(() => ({}));
  if (res.ok) return body;
  const error = typeof body === "object" && body && "error" in body ? String(body.error) : res.statusText;
  throw new ApiFailure(res.status, error);
}

const post = (origin: string, path: string, body: unknown) =>
  fetch(`${origin}${path}`, {
    method: HttpMethod.post,
    headers: { [Header.contentType]: ContentType.json },
    body: JSON.stringify(body),
  }).then(answer);

const get = (origin: string, path: string, token: string) =>
  fetch(`${origin}${path}`, { headers: { [Header.authorization]: `${BEARER_PREFIX}${token}` } }).then(answer);

/** How the API will check a code: the fixed dev code, or an SMS sent by Firebase (not wired here yet). */
export async function requestCode(origin: string, phone: string): Promise<string> {
  const sent = (await post(origin, Route.otpRequest, { phone })) as { channel?: string };
  return String(sent.channel);
}

export async function signIn(origin: string, proof: ConnectorSignIn): Promise<ConnectorSession> {
  return ConnectorSession.parse(await post(origin, Route.signIn, proof));
}

export async function searchWorkers(origin: string, token: string, query: URLSearchParams): Promise<BoardResult> {
  return BoardResult.parse(await get(origin, `${Route.workers}?${query}`, token));
}

export const myCard = (origin: string, token: string) => get(origin, Route.card, token);
export const skills = (origin: string, token: string) => get(origin, Route.skills, token);
