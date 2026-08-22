import { useRef } from "preact/hooks";

import type { FieldConfig } from "../../domain/form";
import { Button } from "../button/button";
import { FormField } from "../form-field/form-field";
import { useTurnstile } from "./turnstile";
import { useForm } from "./use-form";

interface FormProperties<Key extends string> {
  fields: FieldConfig<Key>[];
  /** URL the form data is POSTed to as JSON. */
  endpoint: string;
  submitLabel?: string;
  sendingLabel?: string;
  successMessage?: string;
  /** Shown when the server rejects the submission without its own message. */
  errorFallback?: string;
  /**
   * Cloudflare Turnstile site key (public). When set, submitting runs an
   * invisible challenge and sends the token for the Worker to verify; the
   * widget only becomes visible (inside `.form-turnstile`) if Turnstile needs
   * the visitor to interact. Omit to submit without a token.
   */
  turnstileSiteKey?: string;
  /**
   * Shown when the challenge cannot run or the token is rejected. Should tell
   * the visitor to try again and name another way to get in touch.
   */
  verificationFailedMessage?: string;
}

/**
 * Keeps the active field focused while the submit button is pressed.
 *
 * A press normally moves focus to the button, which blurs the field being
 * edited. If that blur renders a validation message, the button shifts down
 * mid-press and the release misses it, so the click (and the submit) never
 * happens. Preventing pointerdown's default action (the focus transfer)
 * removes the blur; the click itself still fires. Safari on macOS already
 * skips focusing buttons on click, so this matches native behavior there.
 */
const keepFocusOnPress = (event: Event) => event.preventDefault();

export function Form<Key extends string>(props: FormProperties<Key>) {
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const getToken = useTurnstile(props.turnstileSiteKey, turnstileContainer);
  const {
    form,
    showError,
    status,
    serverError,
    setField,
    blurField,
    handleSubmit,
  } = useForm({
    fields: props.fields,
    endpoint: props.endpoint,
    errorFallback: props.errorFallback,
    getToken,
    verificationFailedMessage: props.verificationFailedMessage,
  });

  if (status === "sent") {
    return (
      <p class="form-success" role="status">
        {props.successMessage ?? "Thanks! Your submission was sent."}
      </p>
    );
  }

  return (
    <form class="form" onSubmit={handleSubmit} noValidate>
      {props.fields.map((field) => (
        <FormField
          key={field.name}
          for={field.name}
          label={field.label}
          value={form[field.name]}
          error={showError(field.name)}
          validations={field.validations}
        >
          {field.control === "textarea" ? (
            <textarea
              id={field.name}
              name={field.name}
              rows={field.rows}
              value={form[field.name]}
              placeholder={field.placeholder}
              autocomplete={field.autocomplete}
              onInput={setField(field.name)}
              onBlur={blurField(field.name)}
            />
          ) : (
            <input
              id={field.name}
              name={field.name}
              type={field.control ?? "text"}
              value={form[field.name]}
              placeholder={field.placeholder}
              autocomplete={field.autocomplete}
              onInput={setField(field.name)}
              onBlur={blurField(field.name)}
            />
          )}
        </FormField>
      ))}

      {/* Turnstile renders here; empty unless the challenge needs a click. */}
      {props.turnstileSiteKey && (
        <div class="form-turnstile" ref={turnstileContainer} />
      )}

      <Button
        type="submit"
        class="form-submit"
        disabled={status === "sending"}
        onPointerDown={keepFocusOnPress}
      >
        {status === "sending"
          ? (props.sendingLabel ?? "Sending…")
          : (props.submitLabel ?? "Send")}
      </Button>

      {status === "error" && (
        <p class="form-error" role="alert">
          {serverError}
        </p>
      )}
    </form>
  );
}
