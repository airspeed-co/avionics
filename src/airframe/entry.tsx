import { hydrate } from "preact";
import type { VNode } from "preact";
import { prerender as ssr } from "preact-iso";

import {
  resetServerHead,
  takeServerElements,
  takeServerTitle,
} from "../hooks/use-head";
import { enableClientNavigation } from "./navigation";

export interface SiteEntryOptions {
  /** Renders the whole app for a URL. Called with the route URL when
   *  prerendering and with no URL when hydrating the browser location. */
  renderApp: (url?: string) => VNode;
  /** Default document title (typically the site's formatTitle() with no
   *  page); routes override it via useTitle as they render. */
  defaultTitle: string;
  /** Whether a raw pathname is a page the site renders; gates client
   *  navigation (see ClientNavigationOptions.isPageRoute). */
  isPageRoute: (pathname: string) => boolean;
  /** Locale for the html lang attribute of a prerendered route's URL. */
  localeOf: (url: string) => string;
}

/**
 * Wires a site's entry module: full-hydration MPA with client navigation.
 * Each route is prerendered to static HTML via the returned prerender
 * function, and the browser hydrates the whole page so every component is
 * interactive with no per-feature wiring. After hydration, internal page
 * links navigate client-side (see navigation.tsx); first loads, crawlers,
 * and non-page links still use ordinary page loads.
 *
 * Call at the top level of the site's entry module and re-export prerender:
 *
 *   export const { prerender } = createSiteEntry({ ... });
 */
export function createSiteEntry(options: SiteEntryOptions) {
  if (typeof window !== "undefined") {
    const root = document.getElementById("app")!;

    hydrate(options.renderApp(), root);
    enableClientNavigation(root, options);
  }

  // Bakes the title, the html lang, and any meta the route declared during
  // render into its <head>, so every prerendered file is correct with no
  // client scripting.
  async function prerender(data: { url?: string }) {
    resetServerHead(options.defaultTitle);

    const result = await ssr(options.renderApp(data.url));

    return {
      ...result,
      head: {
        lang: options.localeOf(data.url ?? "/"),
        title: takeServerTitle(),
        elements: takeServerElements(),
      },
    };
  }

  return { prerender };
}
