/**
 * Head data captured while a route renders during prerendering, so the site's
 * prerender entry can bake it into that route's HTML <head>. Effects never run
 * during prerendering, so these are written synchronously as the component
 * renders. In the browser this module's state is only ever touched at build
 * time.
 *
 * Titles are full document titles: sites own their brand format (typically a
 * formatTitle helper in the site's config) and pass the finished string.
 */

interface HeadElement {
  type: string;
  props: Record<string, string>;
}

let serverTitle = "";
let serverElements: HeadElement[] = [];

/** Clears captured head data before prerendering the next route. */
export function resetServerHead(defaultTitle: string) {
  serverTitle = defaultTitle;
  serverElements = [];
}

/** The title captured by the most recent route render. */
export const takeServerTitle = () => serverTitle;

/** The head elements captured by the most recent route render. */
export const takeServerElements = () => serverElements;

/**
 * Sets the document title for the current route. Baked into the prerendered
 * HTML, so the served title is correct with no post-load change for crawlers
 * or link scrapers.
 */
export function useTitle(title: string) {
  serverTitle = title;
}

/** Marks the current route noindex via a baked <meta name="robots">. */
export function useNoindex() {
  serverElements.push({
    type: "meta",
    props: { name: "robots", content: "noindex" },
  });
}

/**
 * Bakes the route's <meta name="description"> at prerender time, so each
 * page gets exactly one, sourced from the site's content layer.
 */
export function useDescription(content: string) {
  serverElements.push({
    type: "meta",
    props: { name: "description", content },
  });
}

/**
 * Bakes the route's social share preview (Open Graph and Twitter title and
 * description) at prerender time, sourced from the site's content layer so
 * link previews match the route's locale. Site-wide share tags that don't
 * vary by route (og:site_name, og:url, og:image, twitter:card) stay in the
 * site's HTML shell.
 */
export function useSocialPreview(title: string, description: string) {
  serverElements.push(
    { type: "meta", props: { property: "og:title", content: title } },
    {
      type: "meta",
      props: { property: "og:description", content: description },
    },
    { type: "meta", props: { name: "twitter:title", content: title } },
    {
      type: "meta",
      props: { name: "twitter:description", content: description },
    },
  );
}

/**
 * Bakes the route's self-referencing canonical link, so URL variants (host,
 * protocol, trailing slash) collapse to the one declared URL.
 */
export function useCanonical(href: string) {
  serverElements.push({
    type: "link",
    props: { rel: "canonical", href },
  });
}

/** Bakes a hreflang alternate link so search engines pair the locales. */
export function useAlternateLanguage(hreflang: string, href: string) {
  serverElements.push({
    type: "link",
    props: { rel: "alternate", hreflang, href },
  });
}

/** Bakes a JSON-LD structured-data script into the route's <head>. */
export function useJsonLd(data: Record<string, unknown>) {
  serverElements.push({
    type: "script",
    props: { type: "application/ld+json", children: JSON.stringify(data) },
  });
}
