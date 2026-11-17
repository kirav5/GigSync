import { BEARER_PREFIX, ContentType, Header, HttpMethod } from "@gigsync/core/http";
import type { Phone } from "@gigsync/protocol";
import type { Env } from "../env.js";

/**
 * Sign-in codes sent by WhatsApp through Meta's Cloud API (ADR 0069): an approved "authentication" template whose body
 * holds the code and whose Copy code button carries it again. Set up in docs/setup/whatsapp-otp.md.
 */

const GRAPH_ORIGIN = "https://graph.facebook.com";
/** The Graph API version used when the Worker sets none; Meta retires a version about two years after its release. */
const DEFAULT_API_VERSION = "v25.0";
/** The template's language when the Worker sets none; it must match a language the template was approved in. */
const DEFAULT_LANGUAGE = "en";
const MESSAGING_PRODUCT = "whatsapp";
const MessageType = { template: "template" } as const;
const ComponentType = { body: "body", button: "button" } as const;
const ParameterType = { text: "text" } as const;
/** An authentication template's Copy code button is sent as Meta's "url" button, at the template's first button. */
const COPY_CODE_BUTTON = { sub_type: "url", index: "0" } as const;
const INTERNATIONAL_PREFIX = "+";

/** What the Worker needs to send a code; all of it set, or WhatsApp is off. */
export interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  template: string;
  language: string;
  apiVersion: string;
}

/** The WhatsApp settings when the token, the sending number and the template are all set; undefined means off. */
export function whatsAppConfig(env: Env): WhatsAppConfig | undefined {
  const { WHATSAPP_TOKEN: token, WHATSAPP_PHONE_NUMBER_ID: phoneNumberId, WHATSAPP_TEMPLATE: template } = env;
  if (!token || !phoneNumberId || !template) return undefined;
  return {
    token,
    phoneNumberId,
    template,
    language: env.WHATSAPP_TEMPLATE_LANGUAGE || DEFAULT_LANGUAGE,
    apiVersion: env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION,
  };
}

/** The message Meta sends: the template, with the code in its body and on its Copy code button. */
export function codeMessage(config: WhatsAppConfig, phone: Phone, code: string) {
  const parameters = [{ type: ParameterType.text, text: code }];
  return {
    messaging_product: MESSAGING_PRODUCT,
    // Meta takes the number without its leading "+".
    to: phone.replace(INTERNATIONAL_PREFIX, ""),
    type: MessageType.template,
    template: {
      name: config.template,
      language: { code: config.language },
      components: [
        { type: ComponentType.body, parameters },
        { type: ComponentType.button, ...COPY_CODE_BUTTON, parameters },
      ],
    },
  };
}

/**
 * Asks Meta to send `code` to `phone`; the HTTP status Meta answered when it refused. Meta accepting it does not
 * mean it was delivered: a number without WhatsApp fails later, and the person asks again or uses another number.
 */
export async function sendCode(config: WhatsAppConfig, phone: Phone, code: string): Promise<number | undefined> {
  const res = await fetch(`${GRAPH_ORIGIN}/${config.apiVersion}/${config.phoneNumberId}/messages`, {
    method: HttpMethod.post,
    headers: { [Header.authorization]: `${BEARER_PREFIX}${config.token}`, [Header.contentType]: ContentType.json },
    body: JSON.stringify(codeMessage(config, phone, code)),
  });
  return res.ok ? undefined : res.status;
}
