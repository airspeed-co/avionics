/*
 * Source discovery and drift protection: what image files exist under a
 * site's source directory, and whether the declared manifest and the
 * directory agree. Drift is an error in both directions (a manifest entry
 * whose source file is missing, or a source file no entry claims) for builds;
 * the dev server tolerates it with a warning (see tolerateDrift) so dropping
 * a new photo into the folder never takes the site down before the config
 * catches up.
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
 * Both directions of drift between the manifest and the source directory.
 *
 * @param {Record<string, import("./index.mjs").ImageEntry>} images
 * @param {string[]} sourceFiles image files found in `sourceDir`
 * @returns {{ missing: string[], unclaimed: string[] }} entry names whose
 *   source file is absent, and source files no entry claims
 */
export function findDrift(images, sourceFiles) {
  const claimed = new Set(Object.values(images).map((entry) => entry.source));

  return {
    missing: Object.entries(images)
      .filter(([, entry]) => !sourceFiles.includes(entry.source))
      .map(([name]) => name),
    unclaimed: sourceFiles.filter((file) => !claimed.has(file)),
  };
}

/**
 * A manifest entry a site can paste for an unclaimed source: the name is the
 * file's base name (subfolder dropped), which is what most entries use.
 * @param {string} file sourceDir-relative source path
 */
export const entrySnippet = (file) =>
  `{ name: "${path.posix.basename(file).replace(/\.[^.]+$/, "")}", source: "${file}" }`;

/**
 * Validates the manifest against the source directory and throws on drift in
 * either direction, listing every offender.
 *
 * @param {string} sourceDir
 * @param {Record<string, import("./index.mjs").ImageEntry>} images
 * @param {string[]} sourceFiles image files found in `sourceDir`
 */
export function checkDrift(sourceDir, images, sourceFiles) {
  const { missing, unclaimed } = findDrift(images, sourceFiles);
  const problems = [
    ...missing.map(
      (name) =>
        `manifest entry has no source file: "${name}" -> ${images[name].source}`,
    ),
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

/**
 * The dev-server counterpart of checkDrift: warns about drift in either
 * direction instead of throwing, prints a ready-to-paste entry for each
 * unclaimed source, and returns the manifest without the entries whose
 * source is missing so generation can carry on with what exists.
 *
 * @param {string} sourceDir
 * @param {Record<string, import("./index.mjs").ImageEntry>} images
 * @param {string[]} sourceFiles image files found in `sourceDir`
 * @param {(message: string) => void} [warn]
 * @returns {Record<string, import("./index.mjs").ImageEntry>}
 */
export function tolerateDrift(
  sourceDir,
  images,
  sourceFiles,
  warn = console.warn,
) {
  const { missing, unclaimed } = findDrift(images, sourceFiles);

  for (const name of missing) {
    warn(
      `[avionics] image "${name}" skipped: ${path.join(sourceDir, images[name].source)} does not exist (the build will fail until the entry or the file is fixed)`,
    );
  }

  for (const file of unclaimed) {
    warn(
      `[avionics] ${path.join(sourceDir, file)} has no manifest entry; add one to avionics.config.mjs (the build will fail until it does):\n  ${entrySnippet(file)},`,
    );
  }

  return Object.fromEntries(
    Object.entries(images).filter(([name]) => !missing.includes(name)),
  );
}
