import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildContactFormFields } from "../domain/contact-form";
import type { ContactFormCopy } from "../domain/contact-form";
import type { FieldConfig } from "../domain/form";
import { requiredValidation } from "../utils/validation";
import { createContactHandler } from "./contact";
import type { ContactEnv } from "./types";

const copy: ContactFormCopy = {
  labels: { name: "Name", email: "Email", phone: "Phone", message: "Message" },
  placeholders: { message: "What can we help you with?" },
  submit: "Send",
  sending: "Sending",
  success: "Sent",
  errorFallback: "Failed",
  verificationFailed: "Unverified",
  validation: {
    required: "Required.",
    email: "Invalid email address.",
    min: "At least {n} characters.",
    max: "At most {n} characters.",
    words: "Say a little more.",
  },
};

const env: ContactEnv = {
  CONTACT_FROM: "site@example.com",
  CONTACT_TO: "inbox@example.com",
  RESEND_API_KEY: "test-key",
};

/** The one email field a signup form collects. */
const emailOnly: FieldConfig<"email">[] = [
  {
    name: "email",
    label: "Email",
    control: "email",
    validations: [requiredValidation("Required.")],
  },
];

function post(body: unknown) {
  return new Request("https://example.com/api/contact", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** The payload the handler sent to Resend on the one call it made. */
function sentEmail() {
  const [, init] = vi.mocked(fetch).mock.calls[0];

  return JSON.parse(String(init?.body)) as {
    subject: string;
    text: string;
    reply_to?: string;
  };
}

describe("createContactHandler", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, text: async () => "" })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the full contact form as labelled lines above the message", async () => {
    const handle = createContactHandler(buildContactFormFields(copy));
    const response = await handle(
      post({
        name: "John Doe",
        email: "john@example.com",
        phone: "910 555 0100",
        message: "I would like to hear more about the Center and its plans.",
      }),
      env,
    );

    expect(response.status).toBe(200);

    const email = sentEmail();

    expect(email.subject).toBe("Contact form: John Doe");
    expect(email.reply_to).toBe("john@example.com");
    expect(email.text).toBe(
      [
        "Name: John Doe",
        "Email: john@example.com",
        "Phone: 910 555 0100",
        "",
        "I would like to hear more about the Center and its plans.",
      ].join("\n"),
    );
  });

  it("leaves out the lines a form did not collect", async () => {
    const handle = createContactHandler(emailOnly, {
      subject: ({ email }) => `Newsletter signup: ${email}`,
      message: "This visitor asked to be added to the newsletter list.",
    });
    const response = await handle(post({ email: "john@example.com" }), env);

    expect(response.status).toBe(200);

    const email = sentEmail();

    expect(email.subject).toBe("Newsletter signup: john@example.com");
    expect(email.text).toBe(
      [
        "Email: john@example.com",
        "",
        "This visitor asked to be added to the newsletter list.",
      ].join("\n"),
    );
  });

  it("prefers a submitted message over the handler's own", async () => {
    const handle = createContactHandler(buildContactFormFields(copy), {
      message: "Never used.",
    });

    await handle(
      post({
        name: "John Doe",
        email: "john@example.com",
        phone: "",
        message: "I would like to hear more about the Center and its plans.",
      }),
      env,
    );

    expect(sentEmail().text).not.toContain("Never used.");
  });

  it("rejects a submission that fails its own field rules", async () => {
    const handle = createContactHandler(emailOnly);
    const response = await handle(post({ email: "" }), env);

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
