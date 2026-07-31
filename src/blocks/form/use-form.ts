import { useState } from "preact/hooks";

import type { FieldConfig, FormStatus } from "../../domain/form";
import { validateForm } from "../../domain/form";

export interface UseFormOptions<Key extends string> {
  fields: FieldConfig<Key>[];
  /** URL the form data is POSTed to as JSON. */
  endpoint: string;
  /** Shown when the server rejects the submission without its own message. */
  errorFallback?: string;
}

export function useForm<Key extends string>({
  fields,
  endpoint,
  errorFallback = "Something went wrong.",
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

    const formElement = event.currentTarget as HTMLFormElement;
    const honeypot = formElement.elements.namedItem(
      "company",
    ) as HTMLInputElement | null;

    if (validateForm(fields, form)) {
      setTouched(
        Object.fromEntries(fields.map((field) => [field.name, true])) as Record<
          Key,
          boolean
        >,
      );

      return;
    }

    setStatus("sending");
    setServerError("");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, company: honeypot?.value ?? "" }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(body?.error ?? errorFallback);
      }

      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setServerError(err instanceof Error ? err.message : errorFallback);
    }
  }

  function reset() {
    setForm(emptyForm);
    setTouched(untouched);
    setStatus("idle");
    setServerError("");
  }

  return {
    form,
    touched,
    status,
    serverError,
    setField,
    blurField,
    handleSubmit,
    reset,
  };
}
