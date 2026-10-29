import {
  type City,
  type Estimate,
  type EstimateRequest,
  type EstimateResponse,
  isEstimate,
  type Place,
  type SharedPrice,
} from "@gigsync/protocol";
import { log } from "../log.js";

/** The server's estimate routes. ApiClient implements them; tests use a fake. */
export interface EstimateApi {
  estimate(request: EstimateRequest): Promise<EstimateResponse>;
  sharePrice(price: SharedPrice): Promise<void>;
}

/** What a phone needs to ask for estimates and share prices: the routes, its city, and its areas' keys. */
export interface EstimateOptions {
  api: EstimateApi;
  city: City;
  /** The pilot area a point is the centre of, as a slug ("hsr-layout"); undefined for any other point. */
  areaKey(place: Place): string | undefined;
}

/**
 * The estimate for a request, or undefined: none for this job, the server unreachable, or any other failure. An
 * estimate is off the core path (ADR 0030 §6): whoever asked falls back to the city's rates, then the owner's numbers.
 */
export async function lookupEstimate(api: EstimateApi, request: EstimateRequest): Promise<Estimate | undefined> {
  try {
    const answer = await api.estimate(request);
    if (isEstimate(answer)) return answer;
    log.info("no estimate", { trade: request.trade, reason: answer.none });
    return undefined;
  } catch (err) {
    log.warn("estimate lookup failed", { trade: request.trade, error: err instanceof Error ? err.name : String(err) });
    return undefined;
  }
}
