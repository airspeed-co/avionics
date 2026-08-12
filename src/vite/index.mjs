/*
 * The avionics Vite plugin: loads the site's `avionics.config.mjs` and drives
 * the parts of the framework that act at build time. For images it runs the
 * engine (see ../images) at dev-server and build start, skipping work via the
 * engine's fingerprint check when nothing changed, and swaps the content of
 * ../blocks/picture/manifest-data.mjs at load time for the generated manifest
 * JSON, which lives in node_modules/.avionics/ so no generated file sits in
 * the site tree. (A load-hook swap, not a resolveId redirect: rolldown
 * resolves relative imports natively without consulting JS resolveId hooks,
 * but load hooks always run.) In dev it watches the config and the source
 * images and regenerates on change with a full reload.
 *
 * Plain .mjs with JSDoc types for the same reason as ../images: Vite loads
 * the site config (and therefore this module) under plain Node, where type
 * stripping inside node_modules is disallowed.
 */

import { realpathSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  checkImages,
  defaultPublicPath,
  generateImages,
} from "../images/index.mjs";

const stubPath = realpathSync(
  fileURLToPath(
    new URL("../blocks/picture/manifest-data.mjs", import.meta.url),
  ),
);

/** Realpath that tolerates ids without a file behind them. */
function tryRealpath(id) {
  try {
    return realpathSync(id);
  } catch {
    return id;
  }
}

/** Module id stripped to a comparable file path: no /@fs prefix, no query. */
function idToFile(id) {
  return tryRealpath(id.replace(/^\/@fs/, "").replace(/[?#].*$/, ""));
}

/**
 * @typedef {object} AvionicsPluginOptions
 * @property {string} [configFile] config path relative to the Vite root,
 *   defaulting to "avionics.config.mjs"
 */

/**
 * The avionics Vite plugin. Reads `avionics.config.mjs` from the site root
 * and, when it has an `images` section, owns image generation end to end.
 *
 * @param {AvionicsPluginOptions} [options]
 * @returns {import("vite").Plugin}
 */
export function avionics({ configFile = "avionics.config.mjs" } = {}) {
  /** @type {string} */
  let root;
  /** @type {string} */
  let configPath;
  /** @type {string} */
  let manifestPath;
  /** @type {import("../images/index.mjs").GenerateOptions | undefined} */
  let imageOptions;
  /** @type {Promise<void> | undefined} */
  let imagesReady;

  async function loadConfig() {
    // Cache-busting query because Node caches ESM imports forever and dev
    // regenerates on config edits.
    const url = `${pathToFileURL(configPath).href}?t=${Date.now()}`;
    const config = (await import(url)).default;
    const images = config?.images;
    const outputDir = images?.outputDir ?? "public/images";

    imageOptions = images && {
      sourceDir: path.resolve(root, images.sourceDir),
      // Resolved for the engine, but the served URL prefix must come from the
      // config-relative directory, so derive it before resolving.
      outputDir: path.resolve(root, outputDir),
      images: images.entries,
      manifestPath,
      publicPath: images.publicPath ?? defaultPublicPath(outputDir),
      ...(images.defaultWidths && { defaultWidths: images.defaultWidths }),
      ...(images.defaultFormats && { defaultFormats: images.defaultFormats }),
    };
  }

  async function ensureImages() {
    if (!imageOptions) return;

    await mkdir(path.dirname(manifestPath), { recursive: true });

    try {
      await checkImages(imageOptions);
    } catch {
      await generateImages(imageOptions);
    }
  }

  return {
    name: "avionics",

    async configResolved(resolved) {
      root = resolved.root;
      configPath = path.resolve(root, configFile);
      manifestPath = path.resolve(root, "node_modules/.avionics/images.json");

      await loadConfig();
    },

    // Fires once per Vite environment (client, worker, prerender); the shared
    // promise makes every environment await the same single generation run.
    buildStart() {
      imagesReady ??= ensureImages();

      return imagesReady;
    },

    async load(id) {
      if (!imageOptions || !id.includes("manifest-data")) return;
      if (idToFile(id) !== stubPath) return;

      await imagesReady;

      const manifest = await readFile(manifestPath, "utf8");

      return `export default ${manifest};`;
    },

    configureServer(server) {
      if (!imageOptions) return;

      server.watcher.add([configPath, imageOptions.sourceDir]);

      const regenerate = async (file) => {
        const fromConfig = file === configPath;
        const fromSource = imageOptions
          ? file.startsWith(imageOptions.sourceDir + path.sep)
          : false;

        if (!fromConfig && !fromSource) return;

        if (fromConfig) await loadConfig();
        imagesReady = ensureImages();
        await imagesReady;

        for (const environment of Object.values(server.environments)) {
          for (const module of environment.moduleGraph.getModulesByFile(
            stubPath,
          ) ?? []) {
            environment.moduleGraph.invalidateModule(module);
          }
        }

        server.ws.send({ type: "full-reload" });
      };

      server.watcher.on("change", regenerate);
      server.watcher.on("add", regenerate);
      server.watcher.on("unlink", regenerate);
    },
  };
}
