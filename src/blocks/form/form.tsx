import type { FieldConfig } from "../../domain/form";
import { Button } from "../button/button";
import { FormField } from "../form-field/form-field";
import { useForm } from "./use-form";

import "./form.css";

interface FormProperties<Key extends string> {
  fields: FieldConfig<Key>[];
  /** URL the form data is POSTed to as JSON. */
  endpoint: string;
  submitLabel?: string;
  sendingLabel?: string;
  successMessage?: string;
  /** Shown when the server rejects the submission without its own message. */
  errorFallback?: string;
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
  const {
    form,
    touched,
    status,
    serverError,
    setField,
    blurField,
    handleSubmit,
  } = useForm({
    fields: props.fields,
    endpoint: props.endpoint,
    errorFallback: props.errorFallback,
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
          error={touched[field.name]}
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

      {/* Honeypot: hidden from humans, bots fill it in. */}
      <label class="form-honeypot" aria-hidden="true">
        Company
        <input type="text" name="company" tabIndex={-1} autoComplete="off" />
      </label>

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
