/*
 * robots.txt emission: allow everything and point crawlers at the sitemap,
 * with the origin taken from the config's `site` section, so no site checks
 * in a robots.txt with its domain typed into it. Whether a deployment may
 * be indexed at all is not decided here: previews are kept out of search by
 * the noindex tag and the Worker's X-Robots-Tag header.
 */

/**
 * The robots.txt body for an origin.
 *
 * @param {string} origin canonical production origin, no trailing slash
 */
export const robotsTxt = (origin) =>
  ["User-agent: *", "Allow: /", "", `Sitemap: ${origin}/sitemap.xml`, ""].join(
    "\n",
  );

/**
 * Emits robots.txt into the client bundle. Replaces any public/robots.txt,
 * so remove the static file when adopting the `site` section.
 *
 * @param {string} origin canonical production origin, no trailing slash
 * @returns {import("vite").Plugin}
 */
export function robotsPlugin(origin) {
  return {
    name: "avionics:robots",
    generateBundle() {
      // Only the client bundle serves static assets.
      if (this.environment?.name !== "client") return;

      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: robotsTxt(origin),
      });
    },
  };
}
