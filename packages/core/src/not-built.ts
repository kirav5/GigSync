/** Thrown by round 2's typed stubs until their partition replaces them; the lead greps for it before committing. */
export class NotBuiltError extends Error {
  constructor(what: string) {
    super(`${what} is not built yet`);
  }
}
