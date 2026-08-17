/**
 * Contact form field names. The phone field is optional for the visitor;
 * the rest are required (see buildContactFormFields).
 */
export type ContactFormKey = "name" | "email" | "phone" | "message";

/**
 * Contact form
 */
export type ContactFormData = Record<ContactFormKey, string>;

/**
 * Every customer-facing string the contact form renders, defined per locale in
 * the content layer (src/content). Validation messages may hold a {n}
 * placeholder for the length bound.
 */
export interface ContactFormCopy {
  labels: Record<ContactFormKey, string>;
  placeholders: {
    /** Hint inside the empty message box prompting what to write. */
    message: string;
  };
  submit: string;
  sending: string;
  success: string;
  errorFallback: string;
  /**
   * Shown when the Turnstile bot check cannot run or rejects the submission.
   * Ask the visitor to try again and point at another way to get in touch;
   * the message was not sent.
   */
  verificationFailed: string;
  validation: {
    required: string;
    email: string;
    min: string;
    max: string;
    /** Message shown when the message field has too few words. */
    words: string;
  };
}
