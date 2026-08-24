/*
 * Sitemap emission: the site's page paths expanded across its locale
 * prefixes, written into the client bundle, so the sitemap derives from the
 * same source of truth as routing and no site checks in a sitemap file.
 */

/**
 * @typedef {object} SitemapOptions
 * @property {string} origin canonical production origin for absolute URLs,
 *   no trailing slash ("https://airspeed.co")
 * @property {string[]} paths locale-agnostic page pathnames ("/", "/audit");
 *   noindexed pages (the 404) do not belong here
 * @property {string[]} [localePrefixes] each locale's home prefix
 *   (["/", "/es"]), matching what the site's splitLocale parses; defaults to
 *   a single unprefixed locale
 */

/**
 * Emits sitemap.xml into the client bundle. Replaces any public/sitemap.xml,
 * so remove the static file when adopting the option.
 *
 * @param {SitemapOptions} options
 * @returns {import("vite").Plugin}
 */
export function sitemapPlugin({ origin, paths, localePrefixes = ["/"] }) {
  return {
    name: "avionics:sitemap",
    generateBundle() {
      // Only the client bundle serves static assets; the worker and
      // prerender environments pass through.
      if (this.environment?.name !== "client") return;

      const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ];

      for (const prefix of localePrefixes) {
        for (const pathname of paths) {
          // Join like locale-prefixed hrefs: the home pathname becomes the
          // bare prefix. The root is the origin plus "/"; every other page
          // is slashless, matching the canonical URLs the pages declare.
          const base = prefix === "/" ? "" : prefix;
          const localized = base + (pathname === "/" ? "" : pathname) || "/";
          const loc =
            localized === "/" ? `${origin}/` : `${origin}${localized}`;

          lines.push("  <url>", `    <loc>${loc}</loc>`, "  </url>");
        }
      }

      lines.push("</urlset>", "");

      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: lines.join("\n"),
      });
    },
  };
}
