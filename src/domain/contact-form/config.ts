import type { FieldConfig } from "../form";
import {
  emailValidation,
  lengthValidation,
  requiredValidation,
  wordsValidation,
} from "../../utils/validation";
import type { ContactFormCopy, ContactFormKey } from "./types";

const withCount = (template: string, count: number) =>
  template.replace("{n}", String(count));

/**
 * Builds the contact form fields with the given locale's copy. The field
 * structure and bounds are fixed; only the strings vary per locale. Sites
 * build one instance per locale for the UI, plus an English instance for the
 * Worker's server-side validation (the server always answers in English).
 */
export function buildContactFormFields(
  copy: ContactFormCopy,
): FieldConfig<ContactFormKey>[] {
  const { labels, placeholders, validation } = copy;
  const required = requiredValidation(validation.required);

  return [
    {
      name: "name",
      label: labels.name,
      autocomplete: "name",
      validations: [
        required,
        lengthValidation({
          max: 100,
          maxMessage: withCount(validation.max, 100),
        }),
      ],
    },
    {
      name: "email",
      label: labels.email,
      control: "email",
      autocomplete: "email",
      validations: [
        required,
        emailValidation(validation.email),
        lengthValidation({
          max: 200,
          maxMessage: withCount(validation.max, 200),
        }),
      ],
    },
    {
      // Optional: no required validation, so an empty value passes.
      name: "phone",
      label: labels.phone,
      control: "tel",
      autocomplete: "tel",
      validations: [
        lengthValidation({
          max: 30,
          maxMessage: withCount(validation.max, 30),
        }),
      ],
    },
    {
      name: "message",
      label: labels.message,
      control: "textarea",
      rows: 6,
      placeholder: placeholders.message,
      validations: [
        required,
        wordsValidation(3, validation.words),
        lengthValidation({
          min: 20,
          max: 500,
          minMessage: withCount(validation.min, 20),
          maxMessage: withCount(validation.max, 500),
        }),
      ],
    },
  ];
}
