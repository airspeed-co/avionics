import type { ComponentChildren, FunctionComponent } from "preact";

import type { Validation } from "../../domain/form";
import { classNames } from "../../utils/class-names";

interface FormFieldProperties {
  label: string;
  for: string;
  /** Show the error message (e.g. after the field has been blurred). */
  error?: boolean;
  value?: string;
  validations?: Validation[];
  children: ComponentChildren;
}

export const FormField: FunctionComponent<FormFieldProperties> = (props) => {
  const message =
    props.value != undefined && props.validations
      ? props.validations
          .map((validate) => validate(props.value!))
          .find(Boolean)
      : undefined;
  const showError = Boolean(props.error && message);

  return (
    <div class={classNames("field", { "field-error": showError })}>
      <label for={props.for}>{props.label}</label>
      {props.children}
      {showError && <p class="field-error-message">{message}</p>}
    </div>
  );
};
