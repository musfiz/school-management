/**
 * The single source of truth for the session cookie name.
 *
 * Kept in its own file so the Edge Runtime (used by `middleware.ts`)
 * can import it without pulling in the server-only `auth.ts` module
 * (which depends on Node's `crypto` for HMAC verification).
 */

export const SESSION_COOKIE = "school_session";
