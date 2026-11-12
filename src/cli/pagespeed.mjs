/*
 * PageSpeed Insights from the command line: the same Lighthouse run that
 * pagespeed.web.dev shows, fetched through Google's API so the numbers are
 * Google's (their machines, their throttling) rather than this laptop's. Runs
 * mobile and desktop and prints category scores, the lab metrics, real-user
 * field data when Chrome has enough traffic to report it, and every audit
 * that lost points. Checks production (the config's `site.domain`) by
 * default, or any public origin passed as an argument (a workers.dev deploy,
 * a pull request preview URL).
 *
 * The API only reaches public URLs; for local work, push a branch and point
 * this at its preview URL, or run Lighthouse locally and read its
 * diagnostics (its score is not comparable to Google's).
 *
 * Needs PAGESPEED_API_KEY, read from the environment or from `.env` at the
 * site root. Keyless calls share a global quota and are often refused with
 * 429. Fails on an API error; scores are reported, not asserted, so this
 * never fails a build.
 *
 * Usage: avionics pagespeed [origin]
 */

import path from "node:path";

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
const LAB_METRICS = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "total-blocking-time",
  "cumulative-layout-shift",
  "speed-index",
];

/**
 * @typedef {{
 *   score: number | null,
 *   scoreDisplayMode: string,
 *   title: string,
 *   displayValue?: string,
 * }} Audit
 */

/**
 * @typedef {{
 *   lighthouseResult: {
 *     lighthouseVersion: string,
 *     categories: Record<string, {title: string, score: number | null}>,
 *     audits: Record<string, Audit>,
 *   },
 *   loadingExperience?: {
 *     overall_category?: string,
 *     metrics?: Record<string, {percentile: number, category: string}>,
 *   },
 * }} PagespeedResult
 */

/**
 * @param {string} url
 * @param {string} apiKey
 * @param {"mobile" | "desktop"} strategy
 * @returns {Promise<PagespeedResult>}
 */
async function run(url, apiKey, strategy) {
  const query = new URLSearchParams({ url, strategy, key: apiKey });

  for (const category of CATEGORIES) {
    query.append("category", category);
  }

  const response = await fetch(`${ENDPOINT}?${query}`);
  /** @type {any} */
  const body = await response.json();

  if (!response.ok) {
    const message = body?.error?.message ?? `${response.status}`;

    throw new Error(`${strategy}: ${message}`);
  }

  return body;
}

/** @param {number | null} score */
const percent = (score) => (score === null ? "n/a" : Math.round(score * 100));

/** @param {number} value */
const seconds = (value) => `${(value / 1000).toFixed(1)}s`;

/**
 * Real-user (Chrome UX Report) numbers arrive in mixed units: milliseconds
 * for timings, hundredths for layout shift.
 * @param {string} key
 * @param {number} percentile
 */
function fieldValue(key, percentile) {
  return key === "CUMULATIVE_LAYOUT_SHIFT_SCORE"
    ? (percentile / 100).toFixed(2)
    : seconds(percentile);
}

/**
 * @param {"mobile" | "desktop"} strategy
 * @param {PagespeedResult} result
 */
function print(strategy, result) {
  const { categories, audits } = result.lighthouseResult;

  console.log(`\n== ${strategy} ==`);
  console.log(
    CATEGORIES.map(
      (key) => `${categories[key].title} ${percent(categories[key].score)}`,
    ).join("  |  "),
  );

  console.log("\nLab metrics:");

  for (const key of LAB_METRICS) {
    const audit = audits[key];

    console.log(
      `  ${audit.title.padEnd(26)} ${(audit.displayValue ?? "").padEnd(8)} (${percent(audit.score)})`,
    );
  }

  const field = result.loadingExperience?.metrics;

  if (field && Object.keys(field).length > 0) {
    console.log(
      `\nField data (real Chrome users, ${result.loadingExperience?.overall_category ?? "unrated"}):`,
    );

    for (const [key, metric] of Object.entries(field)) {
      console.log(
        `  ${key.padEnd(34)} ${fieldValue(key, metric.percentile).padEnd(8)} ${metric.category}`,
      );
    }
  } else {
    console.log("\nField data: none yet (not enough real-user traffic).");
  }

  const losing = Object.entries(audits)
    .filter(
      ([, audit]) =>
        audit.score !== null &&
        audit.score < 1 &&
        audit.scoreDisplayMode !== "informative",
    )
    .sort(([, a], [, b]) => (a.score ?? 0) - (b.score ?? 0));

  console.log(
    losing.length > 0
      ? "\nAudits losing points:"
      : "\nNo audits losing points.",
  );

  for (const [key, audit] of losing) {
    const value = audit.displayValue ? ` (${audit.displayValue})` : "";

    console.log(`  ${percent(audit.score)}  ${audit.title}${value}  [${key}]`);
  }
}

/**
 * @param {object} context
 * @param {string} context.cwd
 * @param {import("../config/index.mjs").Site} context.site
 * @param {string[]} context.args
 */
export async function pagespeed({ cwd, site, args }) {
  try {
    process.loadEnvFile(path.join(cwd, ".env"));
  } catch {
    // No .env; the key may still be in the environment.
  }

  const apiKey = process.env.PAGESPEED_API_KEY;

  if (!apiKey) {
    console.error(
      "PAGESPEED_API_KEY is not set. Add it to .env at the site root (Google Cloud console → PageSpeed Insights API → Credentials).",
    );

    return 1;
  }

  const origin = (args[0] ?? site.origin).replace(/\/+$/, "");
  const url = `${origin}/`;

  console.log(`PageSpeed Insights for ${url}`);

  const [mobile, desktop] = await Promise.all([
    run(url, apiKey, "mobile"),
    run(url, apiKey, "desktop"),
  ]);

  console.log(`Lighthouse ${mobile.lighthouseResult.lighthouseVersion}`);
  print("mobile", mobile);
  print("desktop", desktop);

  return 0;
}
