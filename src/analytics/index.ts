/*
 * Google Analytics 4 for avionics sites: the official gtag bootstrap behind
 * a production gate, plus a typed event helper. A site calls initAnalytics
 * once from its entry module; it no-ops during prerendering (no window),
 * without a measurement id, and on any host other than the canonical
 * origin, so dev servers, local production builds, and preview deployments
 * never pollute the property. GA4's enhanced measurement then tracks page
 * views on its own, including the airframe's client-side page swaps (it
 * listens for history changes).
 *
 * Self-exclusion: visiting any page with ?analytics=off sets a per-browser
 * opt-out (?analytics=on clears it), so the owner's visits don't count as
 * traffic. The flag lives in localStorage rather than an IP filter because
 * iCloud Private Relay rotates addresses, which makes one person look like
 * many.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export interface AnalyticsOptions {
  /** GA4 measurement id ("G-XXXXXXXXXX"). Omit to disable analytics, e.g.
   *  on a site that has no property yet. */
  measurementId?: string;
  /** Canonical production origin ("https://airspeed.co"); analytics only
   *  runs when the page is actually served from it. */
  origin: string;
}

let active = false;

const OPT_OUT_KEY = "analytics";

/** Applies the ?analytics=off|on switch, then reports whether this browser
 *  has opted out. Opted-out loads log to the console for desktop checking;
 *  on a phone (no console), verify with GA4's Realtime report instead:
 *  browse the site and see whether you appear. Wrapped in try/catch
 *  because storage access can throw. */
function optedOut() {
  try {
    const requested = new URLSearchParams(window.location.search).get(
      "analytics",
    );

    if (requested === "off") localStorage.setItem(OPT_OUT_KEY, "off");
    if (requested === "on") localStorage.removeItem(OPT_OUT_KEY);

    const excluded = localStorage.getItem(OPT_OUT_KEY) === "off";

    if (excluded) {
      console.info(
        "Analytics are off in this browser (?analytics=on turns it back on).",
      );
    }

    return excluded;
  } catch {
    return false;
  }
}

/** Loads gtag and starts measurement, when the gates above allow it. */
export function initAnalytics({ measurementId, origin }: AnalyticsOptions) {
  if (!measurementId) return;
  if (typeof window === "undefined") return;
  if (optedOut()) return;
  if (window.location.origin !== origin) return;

  const script = document.createElement("script");

  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);

  window.dataLayer = window.dataLayer ?? [];
  // GA expects the arguments object itself on the dataLayer; an array from
  // rest parameters is silently mishandled, so this stays an old-style
  // function on purpose.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId);

  active = true;
}

/**
 * Records a GA4 event. Safe to call unconditionally from any component:
 * when analytics is off (dev, previews, no id, reduced to a no-op by any
 * gate) the event just drops.
 */
export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
) {
  if (!active || typeof window === "undefined" || !window.gtag) return;

  window.gtag("event", name, params);
}
