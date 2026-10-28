/**
 * Thrown by the typed stubs of the UI rework's Step 0, which fixed every cross-partition signature before the parts
 * were built in parallel. Each stub is replaced by its owner; nothing may throw this once the rework is merged.
 */
export class NotBuiltError extends Error {
  constructor(what: string) {
    super(`${what} is not built yet`);
  }
}
