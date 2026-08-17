import type { ContactFormKey } from "../domain/contact-form";
import type { FieldConfig } from "../domain/form";
import {
  TURNSTILE_TOKEN_FIELD,
  validateForm,
  VERIFICATION_FAILED_CODE,
} from "../domain/form";
import { sendEmail } from "./send-email";
import { verifyTurnstile } from "./turnstile";
import type { ApiErrorResponse, ApiSuccessResponse, ContactEnv } from "./types";

interface ContactPayload {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  [TURNSTILE_TOKEN_FIELD]?: string;
}

function json(body: ApiSuccessResponse | ApiErrorResponse, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Builds the POST /api/contact handler for a site. The fields carry the
 * server-side validation (the site builds them from its contact-form copy);
 * addresses come from the env bindings (see ContactEnv).
 */
export function createContactHandler(fields: FieldConfig<ContactFormKey>[]) {
  return async function handleContact(
    request: Request,
    env: ContactEnv,
  ): Promise<Response> {
    let payload: ContactPayload;

    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    // Bot check first, before any of the payload is trusted. Fails closed
    // with an error the visitor sees; nothing is ever silently dropped, so a
    // human never reads "sent" over a message that went nowhere.
    if (env.TURNSTILE_SECRET_KEY) {
      const verdict = await verifyTurnstile(
        env.TURNSTILE_SECRET_KEY,
        payload[TURNSTILE_TOKEN_FIELD],
        request.headers.get("CF-Connecting-IP"),
      );

      if (!verdict.verified) {
        console.warn("Contact form verification failed:", verdict.reason);

        return json(
          {
            error: "We could not verify this submission. Please try again.",
            code: VERIFICATION_FAILED_CODE,
          },
          400,
        );
      }
    } else {
      console.warn(
        "TURNSTILE_SECRET_KEY unset; contact form accepted without verification.",
      );
    }

    const error = validateForm(fields, payload);

    if (error) {
      return json(
        { error: `The '${error.name}' field is invalid: ${error.message}` },
        400,
      );
    }

    const name = payload.name?.trim() ?? "";
    const email = payload.email?.trim() ?? "";
    const phone = payload.phone?.trim() ?? "";
    const message = payload.message?.trim() ?? "";

    const lines = [`Name: ${name}`, `Email: ${email}`];

    if (phone) {
      lines.push(`Phone: ${phone}`);
    }

    lines.push("", message);

    // Reply-To is the submitter, so replying in the inbox reaches them; the
    // From stays on the verified domain (CONTACT_FROM_NAME shows the brand).
    const from = env.CONTACT_FROM_NAME
      ? `${env.CONTACT_FROM_NAME} <${env.CONTACT_FROM}>`
      : env.CONTACT_FROM;

    try {
      await sendEmail(env, {
        from,
        to: env.CONTACT_TO,
        replyTo: email,
        subject: `Contact form: ${name}`,
        text: lines.join("\n"),
      });
    } catch (err) {
      console.error("Failed to send contact email:", err);

      return json(
        { error: "Could not send your message. Try again later." },
        502,
      );
    }

    return json({ ok: true }, 200);
  };
}
