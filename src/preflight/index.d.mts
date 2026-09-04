/*
 * Hand-written types for index.mjs; keep in sync with the JSDoc there (see
 * ../images/index.d.mts for why the implementation stays .mjs).
 */

export interface PreflightContext {
  /** The origin being checked, no trailing slash. */
  origin: string;
  /** Whether the target is the production host. */
  isProduction: boolean;
  /** The home page HTML. */
  html: string;
  /** Records and prints one check result. */
  report: (ok: boolean, label: string, detail?: string) => void;
  /** Fetch without following redirects, so redirect checks see the 3xx. */
  head: (url: string) => Promise<Response>;
  /** Content of the first meta tag whose property or name matches. */
  metaContent: (html: string, key: string) => string;
}

export interface PreflightOptions {
  /**
   * Apex host of the production deployment ("airspeed.co"); production-only
   * checks apply when the target origin's host matches.
   */
  productionHost: string;
  /**
   * Origin to check, defaulting to `https://${productionHost}` (pass a
   * preview URL to check a preview).
   */
  origin?: string;
  /** POST-only API paths that must reject GET with 405. */
  apiEndpoints?: string[];
  /**
   * Paths that must return 200, defaulting to robots.txt, sitemap.xml, and
   * favicon.svg.
   */
  wellKnownFiles?: string[];
  /**
   * Launch redirects to verify, current path -> previous paths (the same
   * map the site's Worker passes to createRedirects): every previous path
   * must 301 to its current path, and the current path itself must resolve
   * 200. The module holding the map is loaded by Node (type stripping) when
   * preflight imports it, so its own relative imports need the .ts
   * extension (the site tsconfig bases allow it).
   */
  redirects?: Record<string, string[]>;
  /** Site-specific checks, run with the shared helpers before the summary. */
  extraChecks?: (context: PreflightContext) => Promise<void> | void;
}

/**
 * Runs the shared checks, printing one line per check and a summary.
 *
 * @returns the number of failed checks
 */
export function runPreflight(options: PreflightOptions): Promise<number>;
