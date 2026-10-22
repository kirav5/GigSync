/** HTTP names shared by the app and the Workers, so a method or header is never typed as a bare string. */
export const HttpMethod = { get: "GET", post: "POST", options: "OPTIONS" } as const;

export const Header = {
  accept: "accept",
  authorization: "authorization",
  contentType: "content-type",
  upgrade: "upgrade",
  /** Cloudflare's id for one request; reused as our request id so our logs and Cloudflare's line up. */
  cfRay: "cf-ray",
  cfConnectingIp: "cf-connecting-ip",
  requestId: "x-request-id",
} as const;

export const ContentType = { json: "application/json" } as const;

/** `authorization: Bearer <token>` */
export const BEARER_PREFIX = "Bearer ";
export const WEBSOCKET_UPGRADE = "websocket";
