/*
 * Regenerates the PNG icon variants from public/favicon.svg. Run after
 * editing the SVG. The PNGs bake in the SVG's default (light-mode) colors;
 * the prefers-color-scheme swap inside the SVG only applies where the SVG
 * itself is served.
 */

import path from "node:path";

import { importFromSite } from "./site-require.mjs";

const source = "public/favicon.svg";
const outputs = [
  { file: "public/favicon-32.png", size: 32 },
  { file: "public/apple-touch-icon.png", size: 180 },
];

/** @param {{ cwd: string }} context */
export async function favicons({ cwd }) {
  const { default: sharp } = await importFromSite("sharp", cwd);

  for (const { file, size } of outputs) {
    const { size: bytes } = await sharp(path.join(cwd, source), {
      density: 300,
    })
      .resize(size, size)
      .png()
      .toFile(path.join(cwd, file));

    console.log(`${file} (${size}x${size}, ${Math.round(bytes / 1024)} KB)`);
  }

  return 0;
}
