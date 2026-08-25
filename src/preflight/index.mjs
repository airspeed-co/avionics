/*
 * Post-deploy smoke checks shared by avionics sites: fetches a running
 * deployment and verifies the things unit tests cannot see, like redirects,
 * meta tags, sitemap coverage, and whether every referenced asset actually
 * resolves. A site's scripts/preflight.mjs calls runPreflight with its
 * production host and API endpoints, then exits on the returned failure
 * count; production-only checks (www redirect, indexability) apply
 * automatically when the target origin is the production host.
 */

/**
 * @typedef {object} PreflightContext
 * @property {string} origin the origin being checked, no trailing slash
 * @property {boolean} isProduction whether the target is the production host
 * @property {string} html the home page HTML
 * @property {(ok: boolean, label: string, detail?: string) => void} report
 *   records and prints one check result
 * @property {(url: string) => Promise<Response>} head fetch without
 *   following redirects, so redirect checks see the 3xx
 * @property {(html: string, key: string) => string} metaContent content of
 *   the first meta tag whose property or name matches
 */

/**
 * @typedef {object} PreflightOptions
 * @property {string} productionHost apex host of the production deployment
 *   ("airspeed.co"); production-only checks apply when the target origin's
 *   host matches
 * @property {string} [origin] origin to check, defaulting to
 *   `https://${productionHost}` (pass a preview URL to check a preview)
 * @property {string[]} [apiEndpoints] POST-only API paths that must reject
 *   GET with 405
 * @property {string[]} [wellKnownFiles] paths that must return 200,
 *   defaulting to robots.txt, sitemap.xml, and favicon.svg
 * @property {(context: PreflightContext) => Promise<void> | void} [extraChecks]
 *   site-specific checks, run with the shared helpers before the summary
 */

/**
 * Extracts `content` from the first meta tag whose property or name attribute
 * matches, tolerating either attribute order.
 *
 * @param {string} html
 * @param {string} key
 */
function metaContent(html, key) {
  for (const tag of html.match(/<meta\s[^>]*>/g) ?? []) {
    if (
      new RegExp(`(?:property|name)=["']${key}["']`).test(tag) &&
      tag.match(/content=["']([^"']*)["']/)
    ) {
      return tag.match(/content=["']([^"']*)["']/)?.[1] ?? "";
    }
  }

  return "";
}

/**
 * Fetches without following redirects, so redirect checks see the 3xx.
 * @param {string} url
 */
async function head(url) {
  return fetch(url, { method: "GET", redirect: "manual" });
}

/**
 * Runs the shared checks, printing one line per check and a summary.
 *
 * @param {PreflightOptions} options
 * @returns {Promise<number>} the number of failed checks
 */
export async function runPreflight({
  productionHost,
  origin: originOption,
  apiEndpoints = [],
  wellKnownFiles = ["/robots.txt", "/sitemap.xml", "/favicon.svg"],
  extraChecks,
}) {
  const origin = (originOption ?? `https://${productionHost}`).replace(
    /\/+$/,
    "",
  );
  const isProduction = new URL(origin).hostname === productionHost;

  let failures = 0;

  /**
   * @param {boolean} ok
   * @param {string} label
   * @param {string} [detail] shown when the check fails
   */
  function report(ok, label, detail = "") {
    if (!ok) {
      failures += 1;
    }

    console.log(
      `${ok ? "✅" : "❌"} ${label}${ok || !detail ? "" : `: ${detail}`}`,
    );
  }

  // --- Home page ---
  const homeResponse = await fetch(`${origin}/`);
  const html = await homeResponse.text();

  report(
    homeResponse.status === 200,
    "home page returns 200",
    `${homeResponse.status}`,
  );
  report(
    (homeResponse.headers.get("content-type") ?? "").includes("text/html"),
    "home page is text/html",
  );

  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length;

  report(h1Count === 1, "exactly one h1", `found ${h1Count}`);
  report(/<title>[^<]+<\/title>/.test(html), "title tag present");

  // --- Open Graph and Twitter ---
  report(
    metaContent(html, "og:url") === `${origin}/`,
    "og:url matches served origin",
    `got "${metaContent(html, "og:url")}", expected "${origin}/"`,
  );

  for (const key of ["og:image", "twitter:image"]) {
    const imageUrl = metaContent(html, key);

    if (!imageUrl) {
      report(false, `${key} present`);
      continue;
    }

    const image = await fetch(imageUrl);
    const type = image.headers.get("content-type") ?? "";

    report(
      image.status === 200 && type.startsWith("image/"),
      `${key} loads (${imageUrl})`,
      `${image.status} ${type}`,
    );
  }

  // --- Indexability: production must be indexable, previews must not be ---
  // Either signal counts: the header is what the preview environments set,
  // and it covers non-HTML responses that a meta tag cannot reach.
  const noindex =
    /<meta\s[^>]*content=["']noindex["']/.test(html) ||
    (homeResponse.headers.get("x-robots-tag") ?? "").includes("noindex");

  report(
    isProduction ? !noindex : noindex,
    isProduction
      ? "production is indexable (no noindex tag)"
      : "preview is noindexed",
  );

  // --- Referenced assets all resolve ---
  const assetPaths = new Set();

  for (const [, path] of html.matchAll(/(?:src|href)=["'](\/[^"']+)["']/g)) {
    assetPaths.add(path);
  }

  for (const [, srcset] of html.matchAll(/srcset=["']([^"']+)["']/g)) {
    for (const candidate of srcset.split(",")) {
      const path = candidate.trim().split(/\s+/)[0];

      if (path.startsWith("/")) {
        assetPaths.add(path);
      }
    }
  }

  let brokenAssets = 0;

  for (const path of assetPaths) {
    const response = await fetch(`${origin}${path}`);

    if (response.status !== 200) {
      brokenAssets += 1;
      report(false, `asset ${path}`, `${response.status}`);
    }
  }

  report(
    brokenAssets === 0,
    `all ${assetPaths.size} referenced assets load`,
    `${brokenAssets} broken`,
  );

  // --- Well-known files ---
  for (const path of wellKnownFiles) {
    const response = await fetch(`${origin}${path}`);

    report(
      response.status === 200,
      `${path} returns 200`,
      `${response.status}`,
    );
  }

  // --- Every sitemap URL resolves on this deployment ---
  // The sitemap states the pages that should exist (generated by the Vite
  // preset's sitemap option), so a listed page that fails to prerender is
  // caught here instead of going unnoticed until Search Console flags it.
  const sitemapXml = await (await fetch(`${origin}/sitemap.xml`)).text();
  const sitemapPaths = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, loc]) => new URL(loc).pathname,
  );

  let brokenSitemapUrls = 0;

  for (const path of sitemapPaths) {
    const response = await fetch(`${origin}${path}`);

    if (response.status !== 200) {
      brokenSitemapUrls += 1;
      report(false, `sitemap URL ${path}`, `${response.status}`);
    }
  }

  report(
    sitemapPaths.length > 0 && brokenSitemapUrls === 0,
    `all ${sitemapPaths.length} sitemap URLs return 200`,
    `${brokenSitemapUrls} broken`,
  );

  // --- Unknown paths are hard 404s ---
  const missing = await fetch(`${origin}/definitely-not-a-page`);

  report(
    missing.status === 404,
    "unknown path returns a real 404",
    `${missing.status}`,
  );

  // --- Form APIs reject non-POST ---
  for (const path of apiEndpoints) {
    const response = await fetch(`${origin}${path}`);

    report(
      response.status === 405,
      `GET ${path} returns 405`,
      `${response.status}`,
    );
  }

  // --- Production-only: www and http redirect into the canonical origin ---
  if (isProduction) {
    const www = await head(`https://www.${productionHost}/?q=1`);
    const location = www.headers.get("location") ?? "";

    report(
      www.status === 301 && location === `https://${productionHost}/?q=1`,
      "www 301s to apex with query preserved",
      `${www.status} → ${location}`,
    );

    const insecure = await head(`http://${productionHost}/`);

    report(
      [301, 308].includes(insecure.status) &&
        (insecure.headers.get("location") ?? "").startsWith("https://"),
      "http upgrades to https",
      `${insecure.status} → ${insecure.headers.get("location")}`,
    );
  }

  if (extraChecks) {
    await extraChecks({
      origin,
      isProduction,
      html,
      report,
      head,
      metaContent,
    });
  }

  console.log(
    failures === 0
      ? `\nAll checks passed against ${origin}`
      : `\n${failures} check(s) failed against ${origin}`,
  );

  return failures;
}
