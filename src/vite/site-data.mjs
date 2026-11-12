/*
 * Site data: fills ../site/data.ts with the identity resolved from the
 * config's `site` section (see resolveSite in ../config), so site code
 * imports the name, domain, and contact details from
 * "@airspeed-co/avionics/site" instead of repeating them. A load-hook swap
 * for the same reason as the image manifest (see ./core.mjs), served
 * no-cache in dev (see ./stub.mjs). A config edit needs a dev server
 * restart, like every non-image setting.
 */

import { resolveSite } from "../config/index.mjs";
import { loadConfig } from "../config/load.mjs";
import { idToFile, serveStubNoCache, stubFile } from "./stub.mjs";

const stubPath = stubFile("../site/data.ts", import.meta.url);

/**
 * @param {import("../config/index.mjs").Site | undefined} site
 * @returns {import("vite").Plugin}
 */
export function siteDataPlugin(site) {
  return {
    name: "avionics:site-data",

    load(id) {
      if (!id.includes("site/data") || idToFile(id) !== stubPath) return;

      return `export default ${JSON.stringify(site ?? null)};`;
    },

    configureServer(server) {
      serveStubNoCache(server, stubPath, "site/data");
    },
  };
}

/**
 * The site-data plugin on its own, for a site's vitest config: tests do not
 * load the full preset, but site code under test still imports
 * "@airspeed-co/avionics/site".
 *
 * @param {object} [options]
 * @param {string} [options.configFile] config path relative to the working
 *   directory, defaulting to "avionics.config.mjs"
 * @returns {Promise<import("vite").Plugin>}
 */
export async function avionicsSite({ configFile } = {}) {
  return siteDataPlugin(resolveSite(await loadConfig({ configFile })));
}
