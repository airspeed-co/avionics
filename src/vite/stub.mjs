/*
 * Shared plumbing for the stub modules the plugins fill in at load time
 * (the image manifest, the site data): matching a module id or dev request
 * URL to the stub file, and serving the stub no-cache in dev.
 *
 * Why no-cache: a stub lives in node_modules, so Vite hands it (and every
 * module importing it) a ?v= dependency hash and a
 * max-age=31536000,immutable header, on the theory that nothing in
 * node_modules changes while the server runs. A stub does: after its content
 * changes the browser would keep the old module from its HTTP cache, through
 * a full reload and across dev-server restarts, until the tab's cache was
 * bypassed. A content-derived URL would not help either, since the importer
 * that names the URL is cached immutable too; no-cache makes the browser
 * revalidate by etag on every load (a 304 when nothing changed).
 */

import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Real path of a stub module, given its URL relative to the caller.
 *
 * @param {string} relative
 * @param {string} base the caller's import.meta.url
 */
export function stubFile(relative, base) {
  return realpathSync(fileURLToPath(new URL(relative, base)));
}

/**
 * Realpath that tolerates ids without a file behind them.
 *
 * @param {string} id
 */
function tryRealpath(id) {
  try {
    return realpathSync(id);
  } catch {
    return id;
  }
}

/**
 * Module id stripped to a comparable file path: no /@fs prefix, no query.
 *
 * @param {string} id
 */
export function idToFile(id) {
  return tryRealpath(id.replace(/^\/@fs/, "").replace(/[?#].*$/, ""));
}

/**
 * Dev request URL stripped to a comparable file path: root-relative for
 * files under the root (a normal install), /@fs for files outside it (a
 * linked package).
 *
 * @param {string} url
 * @param {string} root
 */
function urlToFile(url, root) {
  return idToFile(url.startsWith("/@fs/") ? url : path.join(root, url));
}

/**
 * Makes the dev server answer requests for a stub with Cache-Control:
 * no-cache instead of Vite's immutable default (see the module comment).
 *
 * @param {import("vite").ViteDevServer} server
 * @param {string} stubPath real path of the stub module
 * @param {string} marker substring of the stub's URL, a cheap test before
 *   the path comparison
 */
export function serveStubNoCache(server, stubPath, marker) {
  server.middlewares.use((req, res, next) => {
    const url = req.url ?? "";

    if (
      url.includes(marker) &&
      urlToFile(url, server.config.root) === stubPath
    ) {
      const setHeader = res.setHeader.bind(res);

      res.setHeader = (name, value) =>
        setHeader(
          name,
          name.toLowerCase() === "cache-control" ? "no-cache" : value,
        );
    }

    next();
  });
}
