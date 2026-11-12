/*
 * Screenshot contact sheet: renders every configured route at every
 * viewport in Chromium and WebKit, writing the shots plus a clickable
 * index.html to screens/ (gitignored). Serves the prerendered dist/client
 * directly, so run a build first.
 *
 * Routes and viewports come from the config's `screens` section; without
 * one, the home page of every locale is shot at one width per breakpoint
 * tier.
 *
 * Usage: avionics screens
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { localePrefixes } from "../config/index.mjs";
import { importFromSite } from "./site-require.mjs";

const sheetTemplate = new URL("../screens/sheet.html", import.meta.url);
/* Injected into every page before its shot; see the file for why. */
const freezeStyles = fileURLToPath(
  new URL("../screens/freeze.css", import.meta.url),
);

// Widths sit inside each tier of the sites' breakpoints: mobile < 48rem,
// tablet 48-60rem, desktop > 60rem.
const defaultViewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
];

/** @type {Record<string, string>} */
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".xml": "application/xml",
};

/**
 * The routes shot without a `screens.routes` list: the home page of every
 * locale, named "home" on a single-locale site and by locale code otherwise.
 *
 * @param {string[]} locales
 */
export function defaultRoutes(locales) {
  const prefixes = localePrefixes(locales);

  return locales.length === 1
    ? [{ name: "home", path: "/" }]
    : locales.map((locale, index) => ({ name: locale, path: prefixes[index] }));
}

/**
 * Minimal static server for dist/client; directories resolve to index.html.
 *
 * @param {string} root
 * @returns {Promise<{ server: import("node:http").Server, port: number }>}
 */
function serveDist(root) {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    );
    const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");

    for (const candidate of [safePath, join(safePath, "index.html")]) {
      try {
        const file = readFileSync(join(root, candidate));
        const type =
          contentTypes[extname(candidate)] ?? "application/octet-stream";

        response.writeHead(200, { "Content-Type": type });
        response.end(file);

        return;
      } catch {
        // Try the next candidate.
      }
    }

    response.writeHead(404);
    response.end("Not found");
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      // listen() was given a port, so address() is always an AddressInfo here.
      const address = /** @type {import("node:net").AddressInfo} */ (
        server.address()
      );

      resolve({ server, port: address.port });
    });
  });
}

/**
 * Fills the contact-sheet template with one figure per shot.
 *
 * @param {{ file: string, label: string }[]} shots
 */
function contactSheet(shots) {
  const figures = shots
    .map(
      ({ file, label }) => `<figure>
        <a href="${file}" target="_blank"><img src="${file}" alt="${label}" loading="lazy" /></a>
        <figcaption>${label}</figcaption>
      </figure>`,
    )
    .join("\n      ");

  return readFileSync(sheetTemplate, "utf8")
    .replaceAll("{{generated}}", new Date().toISOString())
    .replaceAll("{{figures}}", figures);
}

/**
 * @param {object} context
 * @param {string} context.cwd
 * @param {import("../config/index.mjs").AvionicsConfig} context.config
 * @param {import("../config/index.mjs").Site} context.site
 */
export async function screens({ cwd, config, site }) {
  const root = join(cwd, "dist/client");
  const outDir = join(cwd, "screens");

  if (!existsSync(root)) {
    console.error("No dist/client to shoot; run a build first.");

    return 1;
  }

  const routes = config.screens?.routes ?? defaultRoutes(site.locales);
  const viewports = config.screens?.viewports ?? defaultViewports;
  // Playwright is CommonJS; depending on the entry Node resolves, its
  // launchers sit on the namespace or on its default export.
  const playwright = await importFromSite("playwright", cwd);
  const { chromium, webkit } = playwright.chromium
    ? playwright
    : playwright.default;
  const engines = [
    { name: "chromium", launcher: chromium },
    { name: "webkit", launcher: webkit },
  ];

  const { server, port } = await serveDist(root);
  const shots = [];

  mkdirSync(outDir, { recursive: true });

  try {
    for (const engine of engines) {
      const browser = await engine.launcher.launch();

      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          // Reduced motion keeps scroll-reveal effects from leaving sections
          // hidden, so the full-page shot never catches a fade
          // mid-transition.
          reducedMotion: "reduce",
        });

        for (const route of routes) {
          const page = await context.newPage();
          const file = `${route.name}-${viewport.name}-${engine.name}.png`;

          await page.goto(`http://127.0.0.1:${port}${route.path}`, {
            waitUntil: "load",
          });
          await page.addStyleTag({ path: freezeStyles });
          // Fonts and images both paint asynchronously; WebKit in particular
          // can capture a full-page shot before an async-decoded image has
          // drawn. Lazy images are switched to eager first: one far below
          // the viewport never starts loading, so its decode() would never
          // settle and the full-page shot would show a blank box anyway. A
          // broken image is left for the shot to show rather than failing
          // the whole sheet. The expressions run in the page.
          await page.evaluate("document.fonts.ready");
          await page.evaluate(`Promise.all(
            [...document.images].map((image) => {
              image.loading = "eager";

              return image.decode().catch(() => {});
            }),
          )`);
          await page.screenshot({ path: join(outDir, file), fullPage: true });
          await page.close();

          shots.push({
            file,
            label: `${route.name} · ${viewport.name} · ${engine.name}`,
          });
          console.log(`[screens] ${file}`);
        }

        await context.close();
      }

      await browser.close();
    }
  } finally {
    server.close();
  }

  writeFileSync(join(outDir, "index.html"), contactSheet(shots));
  console.log(`[screens] ${shots.length} shots -> screens/index.html`);

  return 0;
}
