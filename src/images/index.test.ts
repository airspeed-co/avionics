// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  entrySnippet,
  findDrift,
  generateImages,
  tolerateDrift,
} from "./index.mjs";

/** A tiny raster fixture; alpha so the png-fallback path is exercised. */
const fixture = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 24, g: 58, b: 56, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();

describe("generateImages with nested sources", () => {
  let root: string;
  let sourceDir: string;
  let outputDir: string;
  let manifestPath: string;

  beforeAll(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    root = await mkdtemp(path.join(tmpdir(), "avionics-images-"));
    sourceDir = path.join(root, "images");
    outputDir = path.join(root, "public", "images");
    manifestPath = path.join(root, "manifest.json");
    await mkdir(path.join(sourceDir, "photos"), { recursive: true });
    await mkdir(path.join(sourceDir, "brand"), { recursive: true });
    await writeFile(
      path.join(sourceDir, "photos", "team.png"),
      await fixture(64, 48),
    );
    await writeFile(
      path.join(sourceDir, "brand", "logo.png"),
      await fixture(64, 64),
    );
  });

  it("finds subfolder sources, generates variants, and writes the manifest", async () => {
    await generateImages({
      sourceDir,
      outputDir,
      manifestPath,
      images: {
        team: { source: "photos/team.png", widths: [32] },
        logo: {
          source: "brand/logo.png",
          widths: [32],
          formats: ["avif", "png"],
        },
      },
    });

    const outputs = (await readdir(outputDir)).sort();

    expect(outputs).toEqual([
      "logo-32.avif",
      "logo-32.png",
      "team-32.avif",
      "team-32.jpg",
    ]);

    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

    expect(Object.keys(manifest.images).sort()).toEqual(["logo", "team"]);
    expect(manifest.images.logo.formats).toEqual(["avif", "png"]);
  });

  it("in warn mode skips an unclaimed file and a missing source, and still generates", async () => {
    await writeFile(
      path.join(sourceDir, "photos", "stray.png"),
      await fixture(8, 8),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await generateImages({
      sourceDir,
      outputDir,
      manifestPath,
      drift: "warn",
      images: {
        team: { source: "photos/team.png", widths: [32] },
        ghost: { source: "photos/ghost.png", widths: [32] },
      },
    });

    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

    expect(Object.keys(manifest.images)).toEqual(["team"]);
    const messages = warn.mock.calls.map(([message]) => String(message));

    // The missing entry, then every unclaimed file (logo.png from the first
    // test is unclaimed here too), each with an entry to paste.
    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatch(/"ghost" skipped.*ghost\.png does not exist/s);
    expect(messages.slice(1)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /stray\.png has no manifest entry.*\{ name: "stray", source: "photos\/stray\.png" \},/s,
        ),
        expect.stringMatching(
          /logo\.png has no manifest entry.*\{ name: "logo", source: "brand\/logo\.png" \},/s,
        ),
      ]),
    );
    warn.mockRestore();
  });

  it("still hard-errors on an unclaimed file inside a subfolder", async () => {
    await writeFile(
      path.join(sourceDir, "photos", "stray.png"),
      await fixture(8, 8),
    );

    await expect(
      generateImages({
        sourceDir,
        outputDir,
        manifestPath,
        images: {
          team: { source: "photos/team.png", widths: [32] },
          logo: {
            source: "brand/logo.png",
            widths: [32],
            formats: ["avif", "png"],
          },
        },
      }),
    ).rejects.toThrow(/no manifest entry.*stray\.png/s);
  });
});

describe("drift helpers", () => {
  const images = {
    team: { source: "photos/team.png" },
    ghost: { source: "photos/ghost.png" },
  };
  const files = ["photos/team.png", "brand/logo.png"];

  it("reports both directions", () => {
    expect(findDrift(images, files)).toEqual({
      missing: ["ghost"],
      unclaimed: ["brand/logo.png"],
    });
  });

  it("names the snippet after the file, without folder or extension", () => {
    expect(entrySnippet("brand/logo-mark.png")).toBe(
      '{ name: "logo-mark", source: "brand/logo-mark.png" }',
    );
  });

  it("tolerateDrift drops missing entries and reports through the given warn", () => {
    const messages: string[] = [];
    const kept = tolerateDrift("images", images, files, (message) =>
      messages.push(message),
    );

    expect(Object.keys(kept)).toEqual(["team"]);
    expect(messages).toHaveLength(2);
  });
});
