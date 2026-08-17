/**
 * Server-side Cloudflare Turnstile check. The client (blocks/form) sends the
 * token it got from the challenge; this asks Cloudflare whether that token
 * is genuine, unexpired, and issued for our site key's secret.
 *
 * Fails closed: no token, a rejected token, or an unreachable siteverify all
 * count as "not verified". The handler then returns an error the visitor can
 * act on instead of pretending the message went out.
 */

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's always-passing test secret, for local dev and CI. */
export const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

export type TurnstileVerdict =
  { verified: true } | { verified: false; reason: string };

/**
 * @param secretKey the widget's secret (`TURNSTILE_SECRET_KEY`).
 * @param token the token the client sent, if any.
 * @param remoteIp the visitor's IP (`CF-Connecting-IP`), which lets
 * Cloudflare bind the token to the connection that solved the challenge.
 */
export async function verifyTurnstile(
  secretKey: string,
  token: string | undefined,
  remoteIp?: string | null,
): Promise<TurnstileVerdict> {
  if (!token) {
    return { verified: false, reason: "missing-token" };
  }

  const body = new URLSearchParams({ secret: secretKey, response: token });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  let result: SiteverifyResponse;

  try {
    const response = await fetch(SITEVERIFY_URL, { method: "POST", body });

    result = (await response.json()) as SiteverifyResponse;
  } catch (error) {
    return {
      verified: false,
      reason: `siteverify-unreachable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return result.success
    ? { verified: true }
    : {
        verified: false,
        reason: (result["error-codes"] ?? ["unknown"]).join(","),
      };
}
