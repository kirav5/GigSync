import { z } from "zod";
import { DeviceId, EngagementId } from "./ids.js";

/**
 * One agent per job (ADR 0045): a request is sealed to every device a worker has, so before a device's agent answers
 * it, the device claims the engagement in its owner's own mailbox. The first claim wins and stays; every later claim on
 * the same engagement is told which device holds it, and that device alone negotiates.
 */
export const ClaimRequest = z.object({ engagement: EngagementId }).strict();
export type ClaimRequest = z.infer<typeof ClaimRequest>;

/** Which of the owner's devices runs the agent for this engagement. */
export const Claim = z.object({ engagement: EngagementId, owner: DeviceId });
export type Claim = z.infer<typeof Claim>;
