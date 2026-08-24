/*
 * Breakpoint injection: Lightning CSS resolves @custom-media per stylesheet,
 * so the site's shared definitions are prepended to every CSS module before
 * transform.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * @param {string} breakpoints stylesheet of shared @custom-media definitions
 *   (the config's `breakpoints` value), resolved against the Vite root
 * @returns {import("vite").Plugin}
 */
export function breakpointsPlugin(breakpoints) {
  /** @type {string} */
  let breakpointsPath;

  return {
    name: "avionics:breakpoints",
    enforce: "pre",
    configResolved(resolved) {
      breakpointsPath = path.resolve(resolved.root, breakpoints);
    },
    transform(code, id) {
      const file = id.split("?")[0];

      if (!file.endsWith(".css") || file === breakpointsPath) return;

      return readFileSync(breakpointsPath, "utf8") + code;
    },
  };
}
