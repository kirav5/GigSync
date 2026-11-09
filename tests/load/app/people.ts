import {
  ApiClient,
  BEARER_PREFIX,
  ContentType,
  GigDevice,
  Header,
  HttpMethod,
  MemoryStorage,
  type Random,
  SecretKeys,
  SystemClock,
  type WorkerRules,
} from "@gigsync/core";
import { newDeviceSecrets } from "@gigsync/crypto";
import type { ModelGenerateRequest, Place, Session, Trade } from "@gigsync/protocol";
import type { Call } from "../model/corpus.js";

/** One simulated phone: its keys, session, API client and agent, as tests/e2e/test/world.ts builds them. */
export interface Phone {
  session: Session;
  api: ApiClient;
  device: GigDevice;
  fetch: typeof fetch;
  base: string;
}

const UINT32 = 2 ** 32;
const cryptoRandom: Random = { next: () => (crypto.getRandomValues(new Uint32Array(1))[0] as number) / UINT32 };
const PHONE_DIGITS = 8;
/** A fresh test number, never a real one: the 98 block with random digits, as the e2e tests use. */
const newPhone = () => `+9198${Array.from({ length: PHONE_DIGITS }, () => Math.floor(Math.random() * 10)).join("")}`;
const PROTOCOL = 1;

export async function signIn(base: string, code: string, fetchFn: typeof fetch, worker?: WorkerRules): Promise<Phone> {
  const keys = new SecretKeys(newDeviceSecrets());
  const anon = new ApiClient(base, fetchFn);
  const session = await anon.verifyOtp(newPhone(), code, { ...(await keys.publicKeys()), protocol: PROTOCOL });
  const api = anon.as(session);
  const device = new GigDevice({
    relay: api,
    storage: new MemoryStorage(),
    keys,
    clock: new SystemClock(),
    random: cryptoRandom,
    me: { user: session.user, device: session.device },
    contact: { name: "Load test", phone: newPhone() },
    ...(worker ? { worker, autoConfirm: true } : {}),
  });
  return { session, api, device, fetch: fetchFn, base };
}

/** The worker's card on the board, as the app's card interview publishes it. */
export function publishCard(p: Phone, trade: Trade, where: Place, ratePaise: number): Promise<unknown> {
  return p.api.publishProfile({
    display_name: "Load test",
    trades: [trade],
    area: where,
    area_name: "Load test",
    rate_paise: ratePaise,
    languages: ["hi", "en"],
    about: `${trade} for 10 years`,
  });
}

const GENERATE_PATH = "/v1/model/generate";

/** One model call through the API, as the phone's ServerModel sends it; the reply is read and dropped. */
export async function askModel(p: Phone, call: Call): Promise<void> {
  const body: ModelGenerateRequest = {
    prompt: call.prompt,
    max_tokens: call.maxTokens,
    ...(call.temperature === undefined ? {} : { temperature: call.temperature }),
    ...(call.format === undefined ? {} : { json: true }),
    ...(call.format && typeof call.format === "object" ? { schema: call.format as Record<string, unknown> } : {}),
    purpose: call.purpose as ModelGenerateRequest["purpose"] & string,
  };
  const res = await p.fetch(`${p.base}${GENERATE_PATH}`, {
    method: HttpMethod.post,
    headers: {
      [Header.authorization]: `${BEARER_PREFIX}${p.session.token}`,
      [Header.contentType]: ContentType.json,
    },
    body: JSON.stringify(body),
  });
  await res.text();
}
