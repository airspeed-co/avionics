import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "preact";

type ButtonVariant = "primary" | "inverted";

/**
 * Accepts every native button attribute (type, disabled, onClick, ...) plus an
 * optional `href`; passing `href` renders an anchor instead of a button.
 */
type ButtonProps = {
  variant?: ButtonVariant;
  href?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Standard button. Renders an anchor when `href` is passed, otherwise a native
 * button. `variant` sets the color treatment. Extra props (onClick, type,
 * disabled, class) pass through.
 */
export function Button({
  variant = "primary",
  href,
  class: className,
  children,
  ...rest
}: ButtonProps) {
  const classes = ["button", `button-${variant}`, className]
    .filter(Boolean)
    .join(" ");

  if (href !== undefined) {
    return (
      <a
        href={href}
        class={classes}
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      class={classes}
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}
