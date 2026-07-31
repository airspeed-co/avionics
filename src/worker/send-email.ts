import type { ContactEnv } from "./types";

export interface OutgoingEmail {
  /** Sender, either "addr" or "Display Name <addr>". Domain must be verified. */
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}

/**
 * Sends transactional email via Resend. This is the only provider-specific
 * code; swap the body to change providers. Without RESEND_API_KEY (local dev)
 * it logs instead of sending, mirroring miniflare's offline behavior.
 */
export async function sendEmail(
  env: ContactEnv,
  email: OutgoingEmail,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log("[dev] RESEND_API_KEY unset; email not sent:\n", email);

    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: email.from,
      to: email.to,
      reply_to: email.replyTo,
      subject: email.subject,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");

    throw new Error(`Resend responded ${response.status}: ${detail}`);
  }
}
