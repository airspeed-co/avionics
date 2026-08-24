/*
 * index.html stamping: %HOME_TITLE% from the `homeTitle` option (passed in
 * vite.config.ts, where importing the site's content layer is possible), and
 * a robots noindex tag for every mode except `production`, so staging and
 * dev builds never reach search results.
 */

/**
 * @param {string} [homeTitle] replaces %HOME_TITLE% in index.html
 * @returns {import("vite").Plugin}
 */
export function indexHtmlPlugin(homeTitle) {
  /** @type {string} */
  let mode;

  return {
    name: "avionics:index-html",
    configResolved(resolved) {
      mode = resolved.mode;
    },
    transformIndexHtml: {
      order: "pre",
      handler: (html) => ({
        html: homeTitle ? html.replace("%HOME_TITLE%", homeTitle) : html,
        tags:
          mode === "production"
            ? []
            : [
                {
                  tag: "meta",
                  attrs: { name: "robots", content: "noindex" },
                  injectTo: "head",
                },
              ],
      }),
    },
  };
}
