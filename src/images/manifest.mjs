/*
 * The manifest contract shared by generation and checking: where outputs are
 * served from, and the fingerprint that decides whether an entry's outputs
 * are current.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * URL prefix for a served output directory: "public/images" -> "/images".
 * Derive it from the config-relative directory, never a resolved absolute
 * path (see the Vite plugin), or the stripped prefix misses.
 *
 * @param {string} outputDir
 */
export function defaultPublicPath(outputDir) {
  const normalized = path.normalize(outputDir).split(path.sep).join("/");

  return "/" + normalized.replace(/^public\//, "").replace(/^\/+/, "");
}

/**
 * Fingerprint of everything that determines an entry's outputs: the source
 * file's bytes plus the resolved config. checkImages recomputes this without
 * sharp, so a changed source, crop, width list, or format list all read as
 * stale.
 *
 * @param {string} sourcePath
 * @param {import("./index.mjs").ImageEntry} entry
 * @param {object} resolved the entry's effective widths/formats/publicPath
 */
export async function entryFingerprint(sourcePath, entry, resolved) {
  const hash = createHash("sha256");

  hash.update(await readFile(sourcePath));
  hash.update(JSON.stringify({ entry, resolved }));

  return hash.digest("hex").slice(0, 16);
}
