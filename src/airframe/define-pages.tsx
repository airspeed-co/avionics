import type { FunctionComponent } from "preact";

/**
 * Builds a site's route lookup from a pathname → page component map (no
 * file-based routing). resolvePage renders the page for a pathname, falling
 * through to the not-found page; isPageRoute reports whether a pathname is
 * one of the site's pages, which gates client navigation so links to static
 * assets or unknown URLs keep the browser's default behavior. Pathnames are
 * matched with trailing slashes stripped.
 */
export function definePages(
  pages: Record<string, FunctionComponent>,
  notFound: FunctionComponent,
) {
  const normalizePath = (pathname: string) =>
    pathname.replace(/\/+$/, "") || "/";

  const isPageRoute = (pathname: string) => normalizePath(pathname) in pages;

  const resolvePage = (pathname: string) => {
    const Page = pages[normalizePath(pathname)] ?? notFound;

    return <Page />;
  };

  return { resolvePage, isPageRoute };
}
