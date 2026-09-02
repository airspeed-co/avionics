/**
 * Launch redirects: the URLs a page had on a site's previous incarnation,
 * keyed by the page's current path. A site replacing an existing site
 * declares, per current path, every previous path that should 301 to it,
 * and its Worker answers those before touching the asset store, so the old
 * site's standing in search indexes transfers instead of decaying through
 * 404s. The map is site data; this module is only the mechanism.
 */
export type RedirectMap = Record<string, string[]>;

const normalizePath = (pathname: string) => pathname.replace(/\/+$/, "") || "/";

/**
 * Builds the redirect responder from a current-path → previous-paths map.
 * Validates the map eagerly (at Worker startup), so a typo fails loudly on
 * deploy instead of silently never matching: every path must be absolute,
 * no previous path may be claimed by two different targets, and a previous
 * path that is itself a target is a configuration bug.
 *
 * The responder returns a 301 to the target (query string carried over,
 * and the target may include a fragment such as "/#contact") or null when
 * the path is not a known previous path.
 */
export function createRedirects(map: RedirectMap) {
  const lookup = new Map<string, string>();
  const targets = new Set(
    Object.keys(map).map((path) => normalizePath(path.split("#")[0])),
  );

  for (const [target, previousPaths] of Object.entries(map)) {
    if (!target.startsWith("/")) {
      throw new Error(`Redirect target "${target}" must start with "/".`);
    }

    for (const previous of previousPaths) {
      if (!previous.startsWith("/")) {
        throw new Error(
          `Previous path "${previous}" (for "${target}") must start with "/".`,
        );
      }

      const normalized = normalizePath(previous);

      if (targets.has(normalized)) {
        throw new Error(
          `Previous path "${previous}" is itself a redirect target.`,
        );
      }

      const existing = lookup.get(normalized);

      if (existing !== undefined && existing !== target) {
        throw new Error(
          `Previous path "${previous}" points at both "${existing}" and "${target}".`,
        );
      }

      lookup.set(normalized, target);
    }
  }

  return (url: URL): Response | null => {
    const target = lookup.get(normalizePath(url.pathname));

    if (target === undefined) return null;

    const destination = new URL(target, url.origin);

    destination.search = url.search;

    return Response.redirect(destination.href, 301);
  };
}
