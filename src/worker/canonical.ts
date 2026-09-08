/**
 * Builds the canonical-host responder for a site. The apex over https is
 * the one canonical address: `www.` is a second custom domain on the
 * production worker that only exists to 301 here, and plain http on either
 * production host upgrades to https. Path and query survive the redirect.
 * Every other host (localhost in dev, workers.dev, preview domains and
 * preview URLs) is left alone so it keeps serving and advertising itself.
 *
 * The site's Worker calls the responder before anything else, so the
 * redirect wins over every path, including API endpoints.
 *
 * The responder returns the redirect, or undefined when the request is
 * already canonical or on a host it does not manage.
 */
export function createCanonicalRedirect(canonicalOrigin: string) {
  const canonicalHost = new URL(canonicalOrigin).host;

  return function canonicalRedirect(url: URL): Response | undefined {
    const isApex = url.host === canonicalHost;
    const isWww = url.host === `www.${canonicalHost}`;
    const isInsecure = url.protocol === "http:";

    if (!isWww && !(isApex && isInsecure)) {
      return undefined;
    }

    const target = new URL(url);

    target.protocol = "https:";
    target.host = canonicalHost;

    return Response.redirect(target.toString(), 301);
  };
}
