/**
 * Turning an unknown thrown value into something worth writing to a log.
 *
 * `error instanceof Error ? error.message : String(error)` is the obvious way
 * to write this, and it was written eleven times across this repository before
 * this module existed. It is also wrong in exactly the case it exists for: the
 * second branch is reached *precisely* when the value is not an `Error`, and a
 * thrown plain object stringifies to `[object Object]` — SonarQube
 * `typescript:S6551`. `CLAUDE.md` asks for errors to be logged with location,
 * input and message, and `[object Object]` is not a message.
 *
 * A thrown non-`Error` is not hypothetical here. `fetch` rejections, a `throw`
 * of a plain object from a library, and Better Auth's `APIError` shape — which
 * `src/lib/prisma-errors.ts` and the admin actions already duck-type rather
 * than instantiate — all arrive as objects that are not `Error` instances.
 *
 * Nothing in this module throws. Logging code that fails while reporting a
 * failure discards the original error and replaces it with a less useful one,
 * so every path returns a string, including the paths where serialisation
 * itself gives up.
 */

/** A value `JSON.stringify` refused: a circular graph, or a `BigInt`. */
const UNSERIALISABLE = "[unserialisable]";

/**
 * `JSON.stringify` returns `undefined` — not a string — for `undefined`, a
 * function, and a bare symbol. Its type declaration says `string`, so the
 * widening in `describeInput` is what makes that reachable case visible to the
 * compiler rather than a surprise at runtime.
 */
const NOT_SERIALISED = "[not serialisable]";

/**
 * Describes a thrown value in one line, without ever throwing.
 *
 * An `Error` contributes its `message` and not its stack: `CLAUDE.md` requires
 * that no stack trace or internal error text reaches a user, and while this
 * output is server-side only, keeping stacks out of the shared helper means a
 * later caller cannot leak one by accident.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  // `typeof null` is `"object"`, so null is excluded before the object test.
  // Everything left here is a primitive or a function, all of which `String`
  // renders faithfully.
  if (error === null || typeof error !== "object") {
    return String(error);
  }
  return describeObject(error);
}

function describeObject(value: object): string {
  try {
    return JSON.stringify(value);
  } catch {
    return UNSERIALISABLE;
  }
}

/**
 * Describes an action's input for a log line. Separate from `describeError`
 * because an input is expected to be a structure worth seeing in full, while
 * an error is expected to carry a message.
 */
export function describeInput(input: unknown): string {
  try {
    const json: string | undefined = JSON.stringify(input);
    if (json === undefined) {
      return NOT_SERIALISED;
    }
    return json;
  } catch {
    return UNSERIALISABLE;
  }
}

export type ActionErrorLogger = (
  action: string,
  input: unknown,
  error: unknown,
) => void;

/**
 * Builds the error logger a server-action module uses, bound to that module's
 * location.
 *
 * A factory rather than a four-argument function so that call sites stay
 * `logActionError(action, input, error)` — the location is stated once, at the
 * top of the module it describes, where it cannot drift out of step with the
 * file it names.
 */
export function createActionErrorLogger(location: string): ActionErrorLogger {
  return function logActionError(action, input, error) {
    console.error(
      `${location}.${action}: input=${describeInput(input)} — ${describeError(error)}`,
    );
  };
}
