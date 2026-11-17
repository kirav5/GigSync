import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { UserId } from "@gigsync/protocol";
import { z } from "zod";

export interface Env {
  OAUTH_KV: KVNamespace;
  /** Set by the OAuth provider for the sign-in pages. */
  OAUTH_PROVIDER: OAuthHelpers;
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  LOG_PII?: string;
  /** This Worker's own origin: the canonical resource and issuer clients see. */
  PUBLIC_ORIGIN: string;
  /** The GigSync API it signs in to and searches. */
  API_ORIGIN: string;
}

/** What a grant carries to the tools, encrypted in each token: whose it is and their connector token for the API. */
export const Props = z.object({ user: UserId, apiToken: z.string().min(1) });
export type Props = z.infer<typeof Props>;

/** The one permission a person grants: search the board, read the skills list and their own card. */
export const Scope = { read: "gigsync:read" } as const;

/** Where the MCP endpoint lives on this Worker. */
export const MCP_PATH = "/mcp";
