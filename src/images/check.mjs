/*
 * Manifest verification without sharp: recomputes fingerprints and confirms
 * every declared output exists, so builds can fail fast when someone forgets
 * to rerun the generator.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { defaultPublicPath, entryFingerprint } from "./manifest.mjs";
import { checkDrift, listSourceFiles } from "./sources.mjs";

/**
 * Verifies the generated manifest and output files are current with the
 * sources and config, throwing with a "run npm run images" pointer when not.
 * Recomputes only fingerprints (no sharp), so it is cheap enough to gate every
 * build.
 *
 * @param {import("./index.mjs").GenerateOptions} options the same options
 *   passed to generateImages
 */
export async function checkImages({
  sourceDir,
  outputDir,
  images,
  manifestPath,
  publicPath,
  defaultWidths = [480, 960],
  defaultFormats = ["avif", "jpg"],
}) {
  if (!manifestPath) {
    throw new Error("checkImages requires manifestPath");
  }

  const sourceFiles = await listSourceFiles(sourceDir);

  checkDrift(sourceDir, images, sourceFiles);

  const basePath = publicPath ?? defaultPublicPath(outputDir);
  const manifest = await readFile(manifestPath, "utf8").then(
    JSON.parse,
    () => null,
  );
  const problems = [];

  if (!manifest || manifest.basePath !== basePath) {
    problems.push(`${manifestPath} is missing or built for another basePath`);
  } else {
    const outputFiles = new Set(await readdir(outputDir).catch(() => []));

    for (const [name, entry] of Object.entries(images)) {
      const generated = manifest.images[name];
      const fingerprint = await entryFingerprint(
        path.join(sourceDir, entry.source),
        entry,
        {
          widths: entry.widths ?? defaultWidths,
          formats: entry.formats ?? defaultFormats,
          basePath,
        },
      );

      if (!generated) {
        problems.push(`"${name}" has no generated entry`);
      } else if (generated.fingerprint !== fingerprint) {
        problems.push(`"${name}" is stale (source or config changed)`);
      } else {
        for (const width of generated.widths) {
          for (const format of generated.formats) {
            const outputName = `${name}-${width}.${format}`;

            if (!outputFiles.has(outputName)) {
              problems.push(`missing output file: ${outputName}`);
            }
          }
        }
      }
    }

    for (const name of Object.keys(manifest.images)) {
      if (!images[name]) {
        problems.push(`"${name}" was removed but is still in ${manifestPath}`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Generated images out of date (run npm run images):\n  ${problems.join("\n  ")}`,
    );
  }

  console.log(`${manifestPath}: images up to date`);
}
