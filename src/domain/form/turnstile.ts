/**
 * The wire contract between the form block and the Worker handler for
 * Cloudflare Turnstile. Shared here because the block (browser) and the
 * handler (workerd) cannot import each other.
 */

/** JSON field the client sends the Turnstile token under. */
export const TURNSTILE_TOKEN_FIELD = "turnstileToken";

/**
 * Error code the handler returns when the token is missing, rejected, or
 * could not be checked. The block maps it to the site's own copy.
 */
export const VERIFICATION_FAILED_CODE = "verification_failed";
