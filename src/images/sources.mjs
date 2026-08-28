/*
 * Source discovery and drift protection: what image files exist under a
 * site's source directory, and whether the declared manifest and the
 * directory agree. Drift is an error in both directions (a manifest entry
 * whose source file is missing, or a source file no entry claims), never a
 * silent skip.
 */

import path from "node:path";
import { readdir } from "node:fs/promises";

const imagePattern = /\.(jpe?g|png|webp|tiff?|svg)$/i;

/**
 * Image files under `sourceDir`, recursive so sources can be organized into
 * subfolders (photos/, brand/), returned as "/"-separated sourceDir-relative
 * paths so config `source` values stay portable across platforms.
 * @param {string} sourceDir
 */
export const listSourceFiles = async (sourceDir) =>
  (await readdir(sourceDir, { recursive: true }))
    .filter((file) => imagePattern.test(file))
    .map((file) => file.split(path.sep).join("/"));

/**
 * Validates the manifest against the source directory and throws on drift in
 * either direction, listing every offender.
 *
 * @param {string} sourceDir
 * @param {Record<string, import("./index.mjs").ImageEntry>} images
 * @param {string[]} sourceFiles image files found in `sourceDir`
 */
export function checkDrift(sourceDir, images, sourceFiles) {
  const claimed = new Set(Object.values(images).map((entry) => entry.source));
  const missing = Object.entries(images)
    .filter(([, entry]) => !sourceFiles.includes(entry.source))
    .map(([name, entry]) => `"${name}" -> ${entry.source}`);
  const unclaimed = sourceFiles.filter((file) => !claimed.has(file));
  const problems = [
    ...missing.map((item) => `manifest entry has no source file: ${item}`),
    ...unclaimed.map(
      (file) =>
        `source file has no manifest entry: ${path.join(sourceDir, file)}`,
    ),
  ];

  if (problems.length > 0) {
    throw new Error(
      `Image manifest out of sync with ${sourceDir}:\n  ${problems.join("\n  ")}`,
    );
  }
}
