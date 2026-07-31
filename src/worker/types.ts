/**
 * Environment bindings the contact handler needs. A site's wrangler-generated
 * Env satisfies this structurally; the addresses are `vars` in wrangler.jsonc
 * and RESEND_API_KEY is a secret (absent in local dev, where the email is
 * logged instead of sent).
 */
export interface ContactEnv {
  /** Sender address; its domain must be verified in Resend. */
  CONTACT_FROM: string;
  /** Optional display name shown as the sender. */
  CONTACT_FROM_NAME?: string;
  /** Recipient inbox; needs no verification. */
  CONTACT_TO: string;
  RESEND_API_KEY?: string;
}

export interface ApiSuccessResponse {
  ok: true;
}

export interface ApiErrorResponse {
  error: string;
}

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;
