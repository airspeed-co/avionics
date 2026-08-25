import type { RefObject } from "preact";
import { useCallback, useEffect, useRef } from "preact/hooks";

/**
 * Cloudflare Turnstile on the client: loads the widget script on demand,
 * renders an invisible widget into the form, and hands `useForm` a token
 * getter that runs the challenge at submit time. Humans normally see nothing;
 * when Turnstile does need an interaction, the widget appears inside the
 * form's `.form-turnstile` container.
 *
 * Only the site key lives here (public). The Worker verifies the token with
 * the secret key (see worker/turnstile.ts).
 */

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Cloudflare's always-passing test site key, for local dev and CI. */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
  execution: "render" | "execute";
  appearance: "always" | "execute" | "interaction-only";
}

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions,
  ) => string | undefined;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoading: Promise<TurnstileApi> | undefined;

/** Loads the Turnstile script once; later callers share the same promise. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");

    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        reject(new Error("Turnstile script loaded without initializing"));
      }
    };
    script.onerror = () => {
      // Allow a retry on the next submit instead of caching the failure.
      scriptLoading = undefined;
      reject(new Error("Turnstile script failed to load"));
    };
    document.head.append(script);
  });

  return scriptLoading;
}

/** Resolves a pending challenge, one submit at a time. */
interface PendingChallenge {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

/**
 * Renders the widget into `container` (on mount, or at submit if the script
 * was slow or blocked on mount) and returns `getToken`, which runs the
 * challenge and resolves with a fresh token. Tokens are single-use, so the
 * widget is reset before every attempt. With no site key nothing loads and
 * `getToken` is undefined, so the form submits without a token and the
 * Worker decides whether that is allowed.
 */
export function useTurnstile(
  siteKey: string | undefined,
  container: RefObject<HTMLDivElement>,
) {
  const widgetId = useRef<string>();
  const pending = useRef<PendingChallenge>();

  const ensureWidget = useCallback(async (): Promise<{
    turnstile: TurnstileApi;
    id: string;
  }> => {
    const turnstile = await loadTurnstile();

    if (widgetId.current) {
      return { turnstile, id: widgetId.current };
    }

    if (!siteKey || !container.current) {
      throw new Error("Turnstile has no site key or container");
    }

    const settle = (outcome: string | Error) => {
      if (typeof outcome === "string") {
        pending.current?.resolve(outcome);
      } else {
        pending.current?.reject(outcome);
      }

      pending.current = undefined;
    };
    const id = turnstile.render(container.current, {
      sitekey: siteKey,
      execution: "execute",
      appearance: "interaction-only",
      callback: settle,
      "error-callback": () => settle(new Error("Turnstile challenge failed")),
      "expired-callback": () => settle(new Error("Turnstile token expired")),
      "timeout-callback": () =>
        settle(new Error("Turnstile challenge timed out")),
    });

    if (!id) {
      throw new Error("Turnstile widget did not render");
    }

    widgetId.current = id;

    return { turnstile, id };
  }, [siteKey, container]);

  // Warm up when the form nears the viewport, so the script and widget are
  // ready before the first submit without the challenge competing with
  // hydration for the main thread on page load (forms usually sit below the
  // fold, and most visitors never submit). A failure here is not surfaced:
  // getToken retries at submit time and reports the failure to the visitor
  // then.
  useEffect(() => {
    if (!siteKey || !container.current) {
      return;
    }

    const warmUp = () => ensureWidget().catch(() => undefined);

    let observer: IntersectionObserver | undefined;

    if (typeof IntersectionObserver === "undefined") {
      warmUp();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            warmUp();
          }
        },
        // Fire one viewport-height early: the widget is ready by the time
        // the visitor has scrolled to the form and started typing.
        { rootMargin: "100%" },
      );
      observer.observe(container.current);
    }

    return () => {
      observer?.disconnect();

      if (widgetId.current) {
        window.turnstile?.remove(widgetId.current);
        widgetId.current = undefined;
      }
    };
  }, [siteKey, container, ensureWidget]);

  const getToken = useCallback(async (): Promise<string> => {
    const { turnstile, id } = await ensureWidget();

    // The previous token was consumed by the last submit; start clean.
    turnstile.reset(id);

    return new Promise<string>((resolve, reject) => {
      pending.current = { resolve, reject };
      turnstile.execute(id);
    });
  }, [ensureWidget]);

  return siteKey ? getToken : undefined;
}
