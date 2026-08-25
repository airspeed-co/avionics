import { useState } from "preact/hooks";

import type { FieldConfig, FormStatus } from "../../domain/form";
import {
  TURNSTILE_TOKEN_FIELD,
  validateForm,
  VERIFICATION_FAILED_CODE,
} from "../../domain/form";

export interface UseFormOptions<Key extends string> {
  fields: FieldConfig<Key>[];
  /** URL the form data is POSTed to as JSON. */
  endpoint: string;
  /** Shown when the server rejects the submission without its own message. */
  errorFallback?: string;
  /**
   * Runs the Turnstile challenge and resolves with a token to send along
   * (see useTurnstile). Undefined when the form has no site key.
   */
  getToken?: () => Promise<string>;
  /**
   * Shown when the challenge cannot run or the server rejects the token, so
   * the visitor knows to retry (or use another contact route) instead of
   * seeing a generic failure.
   */
  verificationFailedMessage?: string;
  /** Called once when the submission is accepted, e.g. to record an
   *  analytics conversion. */
  onSent?: () => void;
  /**
   * Called when a submit attempt fails, with the stage that failed:
   * "validation" (client-side rules), "verification" (the bot check could
   * not produce a token), or "server" (the endpoint rejected the submission
   * or was unreachable). The detail is the failing field's name for
   * validation (stable across locales, unlike the message copy) and the
   * error message for server (always English, code-controlled). For
   * analytics on form friction; never passes what the visitor typed.
   */
  onError?: (stage: FormErrorStage, detail?: string) => void;
}

/** The stage a failed submit attempt died at (see UseFormOptions.onError). */
export type FormErrorStage = "validation" | "verification" | "server";

export function useForm<Key extends string>({
  fields,
  endpoint,
  errorFallback = "Something went wrong.",
  getToken,
  verificationFailedMessage = errorFallback,
  onSent,
  onError,
}: UseFormOptions<Key>) {
  const emptyForm = Object.fromEntries(
    fields.map((field) => [field.name, ""]),
  ) as Record<Key, string>;
  const untouched = Object.fromEntries(
    fields.map((field) => [field.name, false]),
  ) as Record<Key, boolean>;

  const [form, setForm] = useState(emptyForm);
  const [touched, setTouched] = useState(untouched);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  // Set by the first submit attempt: until then an empty field is never an
  // error, even one the visitor typed into and cleared again.
  const [attempted, setAttempted] = useState(false);

  function setField(name: Key) {
    return (event: Event) => {
      const target = event.currentTarget as
        HTMLInputElement | HTMLTextAreaElement;

      setForm((form) => ({ ...form, [name]: target.value }));
    };
  }

  function blurField(name: Key) {
    return (event: Event) => {
      const target = event.currentTarget as
        HTMLInputElement | HTMLTextAreaElement;

      // Leaving a field empty isn't a mistake ("reward early, punish late"):
      // empty required fields are only flagged by the submit attempt.
      if (target.value === "") return;

      setTouched((touched) => ({
        ...touched,
        [name]: true,
      }));
    };
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    setAttempted(true);

    const validationError = validateForm(fields, form);

    if (validationError) {
      setTouched(
        Object.fromEntries(fields.map((field) => [field.name, true])) as Record<
          Key,
          boolean
        >,
      );
      onError?.("validation", validationError.name);

      return;
    }

    setStatus("sending");
    setServerError("");

    let token: string | undefined;

    if (getToken) {
      try {
        token = await getToken();
      } catch {
        // The challenge could not run (script blocked, network, timeout).
        // Never send unverified and never pretend: tell the visitor.
        setStatus("error");
        setServerError(verificationFailedMessage);
        onError?.("verification");

        return;
      }
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          token ? { ...form, [TURNSTILE_TOKEN_FIELD]: token } : form,
        ),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;

        // The server answers in English; a verification failure is the one
        // error a real visitor can hit, so it gets the site's own copy.
        throw new Error(
          body?.code === VERIFICATION_FAILED_CODE
            ? verificationFailedMessage
            : (body?.error ?? errorFallback),
        );
      }

      setStatus("sent");
      onSent?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : errorFallback;

      setStatus("error");
      setServerError(message);
      onError?.("server", message);
    }
  }

  /**
   * Whether a field should show its validation message: after it has been
   * blurred with content (format errors, "reward early, punish late"), and
   * for an empty field only once a submit has been attempted.
   */
  function showError(name: Key) {
    return touched[name] && (form[name] !== "" || attempted);
  }

  function reset() {
    setForm(emptyForm);
    setTouched(untouched);
    setStatus("idle");
    setServerError("");
    setAttempted(false);
  }

  return {
    form,
    touched,
    showError,
    status,
    serverError,
    setField,
    blurField,
    handleSubmit,
    reset,
  };
}
