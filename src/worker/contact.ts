import type { FieldConfig } from "../domain/form";
import { validateForm } from "../domain/form";
import { sendEmail } from "./send-email";
import type { ApiErrorResponse, ApiSuccessResponse, ContactEnv } from "./types";

interface ContactPayload {
  name?: string;
  email?: string;
  message?: string;
  company?: string; // honeypot
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
export function createContactHandler(
  fields: FieldConfig<"name" | "email" | "message">[],
) {
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

    // Honeypot filled in: pretend success, send nothing.
    if (payload.company) {
      return json({ ok: true }, 200);
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
    const message = payload.message?.trim() ?? "";

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
        text: [`Name: ${name}`, `Email: ${email}`, "", message].join("\n"),
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
