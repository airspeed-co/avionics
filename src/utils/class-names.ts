type ClassValue = string | false | null | undefined | Record<string, unknown>;

/**
 * Build a class string from strings and Solid-style classList objects.
 *
 * classNames("logo", { white: true, big: false }) // "logo white"
 * classNames("field", isError && "field-error")   // "field field-error"
 */
export function classNames(...values: ClassValue[]): string {
  const classes: string[] = [];

  for (const value of values) {
    if (!value) continue;

    if (typeof value === "string") {
      classes.push(value);
    } else {
      for (const [name, condition] of Object.entries(value)) {
        if (condition) classes.push(name);
      }
    }
  }

  return classes.join(" ");
}
