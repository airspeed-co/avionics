import { render } from "preact";
import type { VNode } from "preact";

import { resetServerHead, takeServerTitle } from "../hooks/use-head";

export interface ClientNavigationOptions {
  /** Renders the whole app for a URL; the same component the site hydrates. */
  renderApp: (url: string) => VNode;
  /** Default document title, restored before each route render (typically the
   *  site's formatTitle() with no page). */
  defaultTitle: string;
  /** Whether a pathname is a page the site renders, as opposed to a static
   *  asset or an unknown URL. Only page links are intercepted; everything else
   *  keeps the browser's default behavior. Receives the raw pathname, so the
   *  site strips any locale prefix itself. */
  isPageRoute: (pathname: string) => boolean;
  /** Locale for a pathname, mirrored onto the html lang attribute after each
   *  swap so navigation across locale prefixes keeps the document truthful.
   *  Omit for single-locale sites. */
  localeOf?: (pathname: string) => string;
}

/**
 * Client-side navigation as a progressive enhancement over a prerendered MPA.
 * Every route still ships as static HTML (crawlers and first loads never
 * depend on this), but once hydrated, clicks on internal page links re-render
 * the app in place instead of loading a new document, so navigation is
 * instant. Swaps are deliberately unanimated, like a native app; a site's
 * cross-document view transition CSS still smooths the full page loads this
 * module doesn't handle (no-JS, first loads, non-page links).
 */
export function enableClientNavigation(
  root: Element,
  options: ClientNavigationOptions,
) {
  const { renderApp, defaultTitle, isPageRoute, localeOf } = options;

  const renderRoute = () => {
    // The head hooks capture the title as the route renders (render is
    // synchronous), mirroring what the prerender bakes into each page's HTML.
    resetServerHead(defaultTitle);
    render(renderApp(location.pathname), root);
    document.title = takeServerTitle();

    if (localeOf) {
      document.documentElement.lang = localeOf(location.pathname);
    }
  };

  // WebKit animates programmatic scrolls despite behavior: "instant" when the
  // site opts into CSS scroll-behavior: smooth, so suspend the opt-in for the
  // jump (the scroll itself completes synchronously).
  const jumpWithoutAnimation = (jump: (scroller: HTMLElement) => void) => {
    const scroller = (document.scrollingElement ??
      document.documentElement) as HTMLElement;
    const inlineBehavior = scroller.style.scrollBehavior;

    scroller.style.scrollBehavior = "auto";
    jump(scroller);
    scroller.style.scrollBehavior = inlineBehavior;
  };

  const navigate = (url: URL) => {
    history.pushState(null, "", url);
    renderRoute();

    // Flush layout so the browser applies its pending scroll clamp for the
    // new (possibly shorter) document now; otherwise the clamp resolves after
    // the jump below and silently overwrites it.
    void document.documentElement.offsetHeight;

    // Every swap lands at the top instantly, like a fresh page load. A hash
    // link then scrolls down to its target with default behavior, so the
    // site's CSS scroll-behavior decides the feel: a deliberate glide where
    // the site opts into smooth (and motion is allowed), a plain jump
    // otherwise. Starting from the top keeps the motion deterministic; it
    // never animates from the previous page's scroll offset.
    jumpWithoutAnimation(() => scrollTo({ top: 0, behavior: "instant" }));

    const target = url.hash && document.getElementById(url.hash.slice(1));

    if (target) {
      // scrollTo, not scrollIntoView: scroll bounds can lag the new layout in
      // the swap tick and Blink ignores scrollIntoView in that state, so
      // compute the position (applying scroll-padding manually, which
      // scrollTo skips) and scroll on the next frame, once the swap has
      // painted at the top and the bounds have settled. The timer covers
      // tabs where frames are throttled (hidden or low-power).
      const scrollToTarget = () => {
        const scroller = (document.scrollingElement ??
          document.documentElement) as HTMLElement;
        const padding =
          parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0;

        scrollTo({
          top: target.getBoundingClientRect().top + scrollY - padding,
        });
      };

      let scrolled = false;

      const scrollOnce = () => {
        if (scrolled) return;
        scrolled = true;
        scrollToTarget();
      };

      requestAnimationFrame(scrollOnce);
      setTimeout(scrollOnce, 60);
    }
  };

  addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const link =
      event.target instanceof Element ? event.target.closest("a[href]") : null;

    if (
      !(link instanceof HTMLAnchorElement) ||
      link.target ||
      link.hasAttribute("download") ||
      link.origin !== location.origin ||
      !isPageRoute(link.pathname)
    ) {
      return;
    }

    const samePage =
      link.pathname === location.pathname && link.search === location.search;

    // Same-page hash links keep the browser's native anchor behavior.
    if (samePage && link.hash) return;

    event.preventDefault();

    if (samePage) {
      // A link to the page's own bare URL behaves like a fresh load of it:
      // a hash left over from an earlier anchor jump (/#contact, say) is
      // dropped from the address bar, so a reload or a copied link lands
      // at the top like the visitor did.
      if (location.hash) history.pushState(null, "", link.href);
      scrollTo({ top: 0 });

      return;
    }

    navigate(new URL(link.href));
  });

  addEventListener("popstate", renderRoute);
}
