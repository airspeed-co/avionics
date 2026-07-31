/**
 * Form field validation function
 *
 * @returns an error message if the value is invalid.
 */
export type Validation = (value: string) => string | undefined;

/**
 * Form submission status
 */
export type FormStatus = "idle" | "sending" | "sent" | "error";

/**
 * Renderable form field definition
 */
export interface FieldConfig<Key extends string = string> {
  name: Key;
  label: string;
  /** Control to render. Defaults to a "text" input. */
  control?: "text" | "email" | "textarea";
  /** Row count when the control is a textarea. */
  rows?: number;
  validations: Validation[];
  autocomplete?: AutoFill;
}

export interface ValidationError<Key extends string = string> {
  name: Key;
  message: string;
}
