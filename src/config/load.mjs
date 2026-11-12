/*
 * Loads a site's `avionics.config.mjs` under plain Node, for everything that
 * runs outside Vite: the `avionics` commands (see ../cli) and the site-data
 * plugin a site's vitest config uses (see ../vite/site-data.mjs). Kept apart
 * from ./index.mjs so the config file itself imports nothing from node:.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @param {object} [options]
 * @param {string} [options.cwd] the site root, defaulting to the working
 *   directory
 * @param {string} [options.configFile] config path relative to the root
 * @returns {Promise<import("./index.mjs").AvionicsConfig>}
 */
export async function loadConfig({
  cwd = process.cwd(),
  configFile = "avionics.config.mjs",
} = {}) {
  const configPath = path.resolve(cwd, configFile);

  if (!existsSync(configPath)) {
    throw new Error(
      `No ${configFile} in ${cwd}; run this from the root of an avionics site`,
    );
  }

  return (await import(pathToFileURL(configPath).href)).default ?? {};
}
