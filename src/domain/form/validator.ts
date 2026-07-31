import type { FieldConfig, ValidationError } from "./types";

/**
 * Validate form data against a list of field definitions.
 *
 * @returns the first error or `undefined`.
 */
export function validateForm<Key extends string>(
  fields: FieldConfig<Key>[],
  data: Partial<Record<Key, string>>,
): ValidationError<Key> | undefined {
  for (const field of fields) {
    const value = data[field.name] ?? "";

    for (const validation of field.validations) {
      const error = validation(value);

      if (error) {
        return {
          name: field.name,
          message: error,
        };
      }
    }
  }
}
