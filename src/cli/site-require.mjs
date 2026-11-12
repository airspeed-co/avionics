/*
 * Imports a package from the site's own node_modules. The heavy tools the
 * commands drive (sharp, playwright) are the site's dependencies, not
 * avionics', and a plain import() would resolve from this file's real
 * location, which misses them when the package is npm-linked.
 */

import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @param {string} name package name
 * @param {string} cwd the site root
 * @returns {Promise<any>}
 */
export async function importFromSite(name, cwd) {
  const require = createRequire(path.join(cwd, "package.json"));

  /** @type {string} */
  let resolved;

  try {
    resolved = require.resolve(name);
  } catch {
    throw new Error(
      `This command needs "${name}"; install it in the site (npm install --save-dev ${name})`,
    );
  }

  return import(pathToFileURL(resolved).href);
}
