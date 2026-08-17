/**
 * Environment bindings the contact handler needs. A site's wrangler-generated
 * Env satisfies this structurally; the addresses are `vars` in wrangler.jsonc
 * and the keys are secrets (`wrangler secret put`). Without RESEND_API_KEY
 * (local dev) the email is logged instead of sent; without
 * TURNSTILE_SECRET_KEY the token check is skipped with a console warning, so
 * a deployed worker missing the secret is visible in its logs, not silent.
 */
export interface ContactEnv {
  /** Sender address; its domain must be verified in Resend. */
  CONTACT_FROM: string;
  /** Optional display name shown as the sender. */
  CONTACT_FROM_NAME?: string;
  /** Recipient inbox; needs no verification. */
  CONTACT_TO: string;
  RESEND_API_KEY?: string;
  /**
   * Secret of the Cloudflare Turnstile widget whose site key the form
   * renders. Set it on every deployed worker; in dev use Cloudflare's test
   * secret (TURNSTILE_TEST_SECRET_KEY) or leave it unset to skip the check.
   */
  TURNSTILE_SECRET_KEY?: string;
}

export interface ApiSuccessResponse {
  ok: true;
}

export interface ApiErrorResponse {
  /** English, for logs and as a fallback message. */
  error: string;
  /**
   * Machine-readable reason for errors a real visitor can hit, so the client
   * can show the site's own localized copy (see VERIFICATION_FAILED_CODE).
   */
  code?: string;
}

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;
