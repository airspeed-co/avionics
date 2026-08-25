/*
 * Critical CSS inlining: every prerendered page's render-blocking stylesheet
 * link is replaced with a <style> tag holding the stylesheet's contents. An
 * avionics site's whole stylesheet is a few KB gzipped, well inside the
 * document's first round trip, while the link costs an extra request on the
 * critical path of every first paint (FCP and LCP both wait on it; measured
 * at roughly 400-600 ms of LCP on a throttled mobile connection). Pages are
 * fetched once per visit (the airframe swaps pages client-side after
 * hydration), so losing the stylesheet's separate cache entry costs little.
 *
 * Runs in generateBundle with post enforcement, after the prerender plugin
 * has emitted the page assets. The stylesheet asset itself stays in the
 * bundle: nothing references it after this, but deleting bundle entries
 * other plugins may hold is not worth a dead 404 risk.
 */

const STYLESHEET_LINK =
  /<link rel="stylesheet"[^>]*href="\/([^"]+\.css)"[^>]*>/g;

/** @returns {import("vite").Plugin} */
export function inlineCssPlugin() {
  return {
    name: "avionics:inline-css",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      // Only the client bundle has pages; worker and prerender pass through.
      if (this.environment?.name !== "client") return;

      for (const asset of Object.values(bundle)) {
        if (asset.type !== "asset" || !asset.fileName.endsWith(".html")) {
          continue;
        }

        asset.source = asset.source
          .toString()
          .replace(STYLESHEET_LINK, (tag, fileName) => {
            const stylesheet = bundle[fileName];

            if (stylesheet?.type !== "asset") return tag;

            const css = stylesheet.source.toString();

            // A stylesheet containing "</style" would truncate the document
            // when inlined; leave the link alone rather than emit a broken
            // page (minified Lightning CSS output never contains it).
            if (css.includes("</style")) return tag;

            return `<style>${css}</style>`;
          });
      }
    },
  };
}
