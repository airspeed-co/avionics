#!/usr/bin/env node
/*
 * The `avionics` command: the tooling every avionics site shares, run from
 * the site root and driven by its `avionics.config.mjs`, so no site carries
 * its own copy of these scripts. A site's package.json scripts call it:
 *
 *   "preflight": "avionics preflight",
 *   "build:ci": "avionics build"
 *
 * Each command lives in its own module and resolves to an exit code.
 */

import { resolveSite } from "../config/index.mjs";
import { loadConfig } from "../config/load.mjs";

/**
 * @typedef {object} Command
 * @property {string} summary one line for the usage text
 * @property {boolean} [needsSite] whether the command reads the config's
 *   `site` section; commands without it run in any site, configured or not
 * @property {() => Promise<(context: any) => Promise<number>>} load
 */

/** @type {Record<string, Command>} */
const commands = {
  build: {
    summary: "build for Cloudflare Workers Builds, by branch",
    load: async () => (await import("./build.mjs")).build,
  },
  "confirm-deploy": {
    summary: "show the deploy target and ask before publishing",
    load: async () => (await import("./confirm-deploy.mjs")).confirmDeploy,
  },
  favicons: {
    summary: "regenerate the PNG icons from public/favicon.svg",
    load: async () => (await import("./favicons.mjs")).favicons,
  },
  pagespeed: {
    summary: "PageSpeed Insights scores for production or [origin]",
    needsSite: true,
    load: async () => (await import("./pagespeed.mjs")).pagespeed,
  },
  placeholders: {
    summary: "fail if template placeholders are left in the repo",
    needsSite: true,
    load: async () => (await import("./placeholders.mjs")).placeholders,
  },
  preflight: {
    summary: "smoke-check production, [origin], or --preview",
    needsSite: true,
    load: async () => (await import("./preflight.mjs")).preflight,
  },
  screens: {
    summary: "screenshot contact sheet of the built site",
    needsSite: true,
    load: async () => (await import("./screens.mjs")).screens,
  },
};

function usage() {
  const width = Math.max(...Object.keys(commands).map((name) => name.length));

  return [
    "Usage: avionics <command> [options]",
    "",
    ...Object.entries(commands).map(
      ([name, { summary }]) => `  ${name.padEnd(width)}  ${summary}`,
    ),
  ].join("\n");
}

const [name, ...args] = process.argv.slice(2);
const command = name ? commands[name] : undefined;

if (!command) {
  const asked = !name || ["help", "--help", "-h"].includes(name);

  console.error(asked ? usage() : `Unknown command "${name}".\n\n${usage()}`);
  process.exit(asked ? 0 : 1);
}

try {
  const cwd = process.cwd();
  /** @type {Record<string, unknown>} */
  const context = { cwd, args };

  if (command.needsSite) {
    const config = await loadConfig({ cwd });
    const site = resolveSite(config);

    if (!site) {
      throw new Error(
        `avionics ${name} needs a \`site\` section in avionics.config.mjs`,
      );
    }

    Object.assign(context, { config, site });
  }

  const run = await command.load();

  process.exit(await run(context));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
