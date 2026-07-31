/*
 * The worker typecheck runs without the DOM lib (it clashes with
 * workers-types), but FieldConfig.autocomplete uses the DOM's AutoFill type.
 * The worker only reads validations, so a loose alias suffices here; browser
 * consumers still get the real DOM type.
 */
type AutoFill = string;
