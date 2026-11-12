/*
 * index.html stamping: %HOME_TITLE% from the `homeTitle` option (passed in
 * vite.config.ts, where importing the site's content layer is possible), a
 * robots noindex tag for every mode except `production`, so staging and
 * dev builds never reach search results, and the site-wide Open Graph and
 * Twitter tags derived from the config's `site` section.
 */

const imageTypes = /** @type {Record<string, string>} */ ({
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
});

/**
 * The site-wide social preview tags: everything that is the same on every
 * page. Titles and descriptions are baked per page at prerender time. URLs
 * carry the canonical production origin; the Worker rewrites them to the
 * host actually served (see rewriteOpenGraph in ../worker/html.ts).
 *
 * @param {import("../config/index.mjs").Site} site
 * @returns {import("vite").HtmlTagDescriptor[]}
 */
export function socialTags({ name, origin, socialImage }) {
  const image = `${origin}${socialImage.path}`;
  const extension = socialImage.path.split(".").pop()?.toLowerCase() ?? "";
  const type = imageTypes[extension] ?? "";

  /** @type {[attribute: "property" | "name", key: string, content: string][]} */
  const tags = [
    ["property", "og:type", "website"],
    ["property", "og:site_name", name],
    ["property", "og:url", `${origin}/`],
    ["property", "og:image", image],
    ["property", "og:image:type", type],
    ["property", "og:image:width", `${socialImage.width}`],
    ["property", "og:image:height", `${socialImage.height}`],
    ["property", "og:image:alt", socialImage.alt],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:image", image],
  ];

  return (
    tags
      // An image format without a known media type simply goes unlabeled.
      .filter(([, , content]) => content)
      .map(([attribute, key, content]) => ({
        tag: "meta",
        attrs: { [attribute]: key, content },
        injectTo: "head",
      }))
  );
}

/**
 * @param {string} [homeTitle] replaces %HOME_TITLE% in index.html
 * @param {import("../config/index.mjs").Site} [site] the resolved site; when
 *   set, its social preview tags are injected, so index.html must not
 *   declare its own
 * @returns {import("vite").Plugin}
 */
export function indexHtmlPlugin(homeTitle, site) {
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
        tags: [
          ...(site ? socialTags(site) : []),
          ...(mode === "production"
            ? []
            : [
                /** @type {import("vite").HtmlTagDescriptor} */ ({
                  tag: "meta",
                  attrs: { name: "robots", content: "noindex" },
                  injectTo: "head",
                }),
              ]),
        ],
      }),
    },
  };
}
