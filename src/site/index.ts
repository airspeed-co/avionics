/*
 * The site's identity, as written once in the `site` section of
 * `avionics.config.mjs`: name, domain, contact details, locales, plus the
 * values derived from them (the canonical origin). Site code imports it from
 * here instead of repeating the values, in the browser bundle and the Worker
 * alike:
 *
 *   import { site } from "@airspeed-co/avionics/site";
 *
 *   export const formatTitle = (page: string) => `${page} | ${site.name}`;
 *
 * The data arrives through ./data.ts, which the avionics Vite plugin fills
 * in at build time. A site's vitest config adds `avionicsSite()` from
 * "@airspeed-co/avionics/vite" for the same effect in tests.
 */

import type { Site } from "../config/index.mjs";
import data from "./data";

export type { Site };

if (!data) {
  throw new Error(
    'No site data available; add a `site` section to avionics.config.mjs and build with the avionics Vite plugin (in vitest.config.ts, add avionicsSite() from "@airspeed-co/avionics/vite")',
  );
}

export const site: Site = data;
