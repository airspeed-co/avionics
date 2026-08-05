class OpenGraphUrls {
  constructor(private origin: string) {}

  element(element: Element) {
    const key =
      element.getAttribute("property") ?? element.getAttribute("name");

    if (key === "og:url") {
      element.setAttribute("content", `${this.origin}/`);
    } else if (key === "og:image" || key === "twitter:image") {
      const content = element.getAttribute("content");

      if (content) {
        // Keep whatever path the document declares (filename and extension
        // are the site's choice) and swap only the host.
        const { pathname, search } = new URL(content, this.origin);

        element.setAttribute("content", `${this.origin}${pathname}${search}`);
      }
    }
  }
}

/**
 * Rewrites the Open Graph / Twitter URLs to the origin actually being served,
 * so every preview URL and production each advertise themselves with no host
 * baked in at build time. index.html holds the canonical production URLs as the
 * fallback used if this rewrite ever does not run.
 */
export function rewriteOpenGraph(response: Response, origin: string): Response {
  return new HTMLRewriter()
    .on(
      'meta[property="og:url"], meta[property="og:image"], meta[name="twitter:image"]',
      new OpenGraphUrls(origin),
    )
    .transform(response);
}
