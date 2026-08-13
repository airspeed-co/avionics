/*
 * The avionics Vite preset: loads the site's `avionics.config.mjs` and turns
 * it into the full build setup, so a site's vite.config.ts holds only truly
 * site-specific plugins. The returned array carries:
 *
 * - the core plugin: base Vite config every avionics site shares (preact
 *   dedupe, serving avionics as source, Lightning CSS with the site's browser
 *   targets) plus the image pipeline (see ../images), generated at dev-server
 *   and build start with fingerprint skipping, swapping the content of
 *   ../blocks/picture/manifest-data.mjs at load time for the generated
 *   manifest JSON kept in node_modules/.avionics/. (A load-hook swap, not a
 *   resolveId redirect: rolldown resolves relative imports natively without
 *   consulting JS resolveId hooks, but load hooks always run.) In dev it
 *   watches the config and the source images and regenerates on change;
 *   non-image config changes (breakpoints, browsers, prerender) need a dev
 *   server restart.
 * - a breakpoints plugin (when `breakpoints` is configured): Lightning CSS
 *   resolves @custom-media per stylesheet, so the shared definitions are
 *   prepended to every CSS module before transform.
 * - an index.html plugin: stamps %HOME_TITLE% from the `homeTitle` option
 *   (passed in vite.config.ts, where importing the site's content layer is
 *   possible), and injects a robots noindex tag for every mode except
 *   `production`, so staging and dev builds never reach search results.
 * - the preact preset with prerendering enabled, routes from `prerender`.
 *
 * The factory is async (Vite awaits promises in the plugins array) because
 * the preact preset needs the config's prerender routes at construction. The
 * config file is read from the process working directory; image and
 * breakpoint paths resolve against the Vite root as usual.
 *
 * Plain .mjs with JSDoc types for the same reason as ../images: Vite loads
 * the site config (and therefore this module) under plain Node, where type
 * stripping inside node_modules is disallowed.
 */

import { readFileSync, realpathSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import preact from "@preact/preset-vite";
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
 * @property {string} [configFile] config path relative to the working
 *   directory, defaulting to "avionics.config.mjs"
 * @property {string} [homeTitle] replaces %HOME_TITLE% in index.html; passed
 *   here rather than configured in avionics.config.mjs because the title
 *   lives in the site's TypeScript content layer, which vite.config.ts can
 *   import and plain Node cannot
 */

/**
 * The avionics Vite preset. Reads `avionics.config.mjs` and returns the
 * shared plugin set; see the module comment for what it covers.
 *
 * @param {AvionicsPluginOptions} [options]
 * @returns {Promise<import("vite").PluginOption[]>}
 */
export async function avionics({
  configFile = "avionics.config.mjs",
  homeTitle,
} = {}) {
  const configPath = path.resolve(process.cwd(), configFile);

  /** Re-imported with a cache-busting query because Node caches ESM imports
   *  forever and dev regenerates on config edits. */
  async function importConfig() {
    const url = `${pathToFileURL(configPath).href}?t=${Date.now()}`;

    return (await import(url)).default ?? {};
  }

  const config = await importConfig();
  const targets = browserslistToTargets(
    browserslist(config.browsers ?? defaultBrowsers),
  );

  /** @type {string} */
  let root;
  /** @type {string} */
  let mode;
  /** @type {string} */
  let manifestPath;
  /** @type {import("../images/index.mjs").GenerateOptions | undefined} */
  let imageOptions;
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

  /** @type {import("vite").Plugin} */
  const core = {
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
      mode = resolved.mode;
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

      server.watcher.add([configPath, imageOptions.sourceDir]);

      const regenerate = async (file) => {
        const fromConfig = file === configPath;
        const fromSource = imageOptions
          ? file.startsWith(imageOptions.sourceDir + path.sep)
          : false;

        if (!fromConfig && !fromSource) return;

        if (fromConfig) resolveImageOptions(await importConfig());
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

  /** @type {import("vite").PluginOption[]} */
  const plugins = [core];

  if (config.breakpoints) {
    /** @type {string} */
    let breakpointsPath;

    plugins.push({
      name: "avionics:breakpoints",
      enforce: "pre",
      configResolved(resolved) {
        breakpointsPath = path.resolve(resolved.root, config.breakpoints);
      },
      transform(code, id) {
        const file = id.split("?")[0];

        if (!file.endsWith(".css") || file === breakpointsPath) return;

        return readFileSync(breakpointsPath, "utf8") + code;
      },
    });
  }

  plugins.push({
    name: "avionics:index-html",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => ({
        html: homeTitle ? html.replace("%HOME_TITLE%", homeTitle) : html,
        tags:
          mode === "production"
            ? []
            : [
                {
                  tag: "meta",
                  attrs: { name: "robots", content: "noindex" },
                  injectTo: "head",
                },
              ],
      }),
    },
  });

  plugins.push(
    preact({
      prerender: {
        enabled: true,
        renderTarget: config.prerender?.renderTarget ?? "#app",
        additionalPrerenderRoutes: config.prerender?.routes ?? [],
      },
    }),
  );

  return plugins;
}
