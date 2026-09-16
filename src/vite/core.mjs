/*
 * The core avionics plugin: the base Vite config every avionics site shares
 * (preact dedupe, serving avionics as source, Lightning CSS with the site's
 * browser targets) plus the image pipeline (see ../images), generated at
 * dev-server and build start with fingerprint skipping, swapping the content
 * of ../blocks/picture/manifest-data.mjs at load time for the generated
 * manifest JSON kept in node_modules/.avionics/. (A load-hook swap, not a
 * resolveId redirect: rolldown resolves relative imports natively without
 * consulting JS resolveId hooks, but load hooks always run.) In dev it
 * watches the config and the source images and regenerates on change;
 * non-image config changes (breakpoints, browsers, prerender) need a dev
 * server restart.
 *
 * Dev serves the swapped module no-cache. The stub lives in node_modules,
 * so Vite hands it (and every module importing it) a ?v= dependency hash
 * and a max-age=31536000,immutable header, on the theory that nothing in
 * node_modules changes while the server runs. This module does: after a
 * regeneration the browser would keep the old manifest from its HTTP cache,
 * through the full reload and across dev-server restarts, until the tab's
 * cache was bypassed. A content-derived URL would not help either, since the
 * importer that names the URL is cached immutable too; no-cache makes the
 * browser revalidate by etag on every load (a 304 when nothing changed) and
 * pick up the regenerated manifest.
 */

import { realpathSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";

import {
  checkImages,
  defaultPublicPath,
  generateImages,
} from "../images/index.mjs";

const defaultBrowsers = "defaults, safari >= 15, ios_saf >= 15";

const stubPath = realpathSync(
  fileURLToPath(
    new URL("../blocks/picture/manifest-data.mjs", import.meta.url),
  ),
);

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
function idToFile(id) {
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
 * The config's entry list as the record the image engine consumes. The list
 * form can express duplicate names, so reject them here.
 *
 * @param {import("../config/index.mjs").NamedImageEntry[]} entries
 * @returns {Record<string, import("../images/index.mjs").ImageEntry>}
 */
function recordFromEntries(entries) {
  /** @type {Record<string, import("../images/index.mjs").ImageEntry>} */
  const record = {};

  for (const { name, ...entry } of entries) {
    if (record[name]) {
      throw new Error(`Duplicate image entry name "${name}"`);
    }

    record[name] = entry;
  }

  return record;
}

/**
 * @param {object} options
 * @param {import("../config/index.mjs").AvionicsConfig} options.config the
 *   loaded site config
 * @param {string} options.configPath absolute path of the config file, for
 *   the dev watcher
 * @param {() => Promise<import("../config/index.mjs").AvionicsConfig>} options.importConfig
 *   re-imports the config fresh, for dev regeneration on config edits
 * @returns {import("vite").Plugin}
 */
export function corePlugin({ config, configPath, importConfig }) {
  const targets = browserslistToTargets(
    browserslist(config.browsers ?? defaultBrowsers),
  );

  /** @type {string} */
  let root;
  /** @type {string} */
  let manifestPath;
  /** @type {import("../images/index.mjs").GenerateOptions | undefined} */
  let imageOptions;
  /** Vite's command: the dev server tolerates image drift, builds do not. */
  let command = "build";
  /** @type {Promise<void> | undefined} */
  let imagesReady;

  /** @param {typeof config} loaded */
  function resolveImageOptions(loaded) {
    const images = loaded?.images;
    const outputDir = images?.outputDir ?? "public/images";

    imageOptions = images && {
      sourceDir: path.resolve(root, images.sourceDir),
      // Resolved for the engine, but the served URL prefix must come from the
      // config-relative directory, so derive it before resolving.
      outputDir: path.resolve(root, outputDir),
      images: recordFromEntries(images.entries),
      manifestPath,
      publicPath: images.publicPath ?? defaultPublicPath(outputDir),
      drift: command === "serve" ? "warn" : "error",
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

    config: () => ({
      // One preact only: when the package is npm-linked, its own node_modules
      // holds a second copy, and duplicate preact breaks hooks.
      resolve: {
        dedupe: ["preact"],
      },
      // Avionics ships raw TS source, so serve it as source instead of
      // pre-bundling: dev picks up package changes without a server restart,
      // and edits hot-reload while the package is linked locally.
      optimizeDeps: {
        exclude: ["@airspeed-co/avionics"],
      },
      css: {
        transformer: "lightningcss",
        lightningcss: {
          targets,
          drafts: { customMedia: true },
        },
      },
      build: {
        cssMinify: "lightningcss",
        cssTarget: "safari15",
      },
    }),

    configResolved(resolved) {
      root = resolved.root;
      command = resolved.command;
      manifestPath = path.resolve(root, "node_modules/.avionics/images.json");

      resolveImageOptions(config);
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

      // Vite serves node_modules modules immutable; see the module comment
      // for why this one must revalidate instead.
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";

        if (
          url.includes("manifest-data") &&
          urlToFile(url, root) === stubPath
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

      server.watcher.add([configPath, imageOptions.sourceDir]);

      /** @param {string} file */
      const regenerate = async (file) => {
        const fromConfig = file === configPath;
        const fromSource = imageOptions
          ? file.startsWith(imageOptions.sourceDir + path.sep)
          : false;

        if (!fromConfig && !fromSource) return;

        if (fromConfig) resolveImageOptions(await importConfig());

        // A regeneration that fails (a bad crop, a half-copied file) logs and
        // leaves the last good manifest in place, so one wrong edit does not
        // 500 every page until it is fixed.
        const next = ensureImages();

        try {
          await next;
        } catch (error) {
          console.error(
            `[avionics] image regeneration failed; still serving the previous images.\n${error instanceof Error ? error.message : error}`,
          );

          return;
        }

        imagesReady = next;

        // Drop the server's cached transform so the next request re-reads
        // the manifest; the no-cache header above makes sure that request
        // happens after the reload.
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
