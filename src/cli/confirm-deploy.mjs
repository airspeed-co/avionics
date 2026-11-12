/*
 * Deploy guard: prints which site, worker, and hostnames are about to be
 * published and waits for a yes. Runs before the build in a site's deploy
 * script, so declining costs nothing.
 *
 * The failure it exists to prevent is running `npm run deploy` in the wrong
 * repo, so the site directory is the loudest line.
 *
 * Skipped without a TTY or when CI is set: Cloudflare Workers Builds runs
 * `npx wrangler deploy` directly and never reaches this command, but a hook
 * or a piped shell should not hang waiting for input either.
 *
 * Usage: avionics confirm-deploy [--env <name>] [--config <path>]
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";

import { parseJsonc } from "./jsonc.mjs";

/**
 * What a deploy of this wrangler config would publish.
 *
 * @param {any} config the parsed wrangler config
 * @param {string} [environment] the wrangler environment, if any
 */
export function deployTarget(config, environment) {
  const section = environment ? (config.env?.[environment] ?? {}) : config;

  // Environments deploy as their own worker, named `<name>-<env>` unless the
  // environment overrides the name outright.
  const worker =
    section.name ??
    (environment ? `${config.name}-${environment}` : config.name);

  /** @type {{pattern?: string}[]} */
  const routes = section.routes ?? [];
  const hostnames = routes.map((route) => route.pattern).filter(Boolean);
  const workersDev = section.workers_dev ?? false;

  return {
    worker,
    targets: [...hostnames, ...(workersDev ? ["its workers.dev URL"] : [])],
  };
}

/** @param {{ cwd: string, args: string[] }} context */
export async function confirmDeploy({ cwd, args }) {
  /** @param {string} flag */
  const flagValue = (flag) => {
    const index = args.indexOf(flag);

    return index === -1 ? undefined : args[index + 1];
  };

  if (!process.stdin.isTTY || process.env.CI) {
    return 0;
  }

  const environment = flagValue("--env");
  const configPath = path.join(cwd, flagValue("--config") ?? "wrangler.jsonc");
  const { worker, targets } = deployTarget(
    parseJsonc(readFileSync(configPath, "utf8")),
    environment,
  );
  const isProduction = environment === undefined;

  console.log("");
  console.log(`  Site         ${path.basename(cwd)}`);
  console.log(`  Worker       ${worker}`);
  console.log(`  Environment  ${environment ?? "production (top level)"}`);
  console.log(
    `  Serving      ${targets.length > 0 ? targets.join(", ") : "no public URL (unrouted)"}`,
  );
  console.log("");

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Ctrl+C and Ctrl+D reject the question; both mean "no", so they cancel
  // the deploy rather than surfacing an abort stack trace.
  const answer = await readline
    .question(`Deploy${isProduction ? " to PRODUCTION" : ""}? [y/N] `)
    .catch(() => "");

  readline.close();

  if (!/^y(es)?$/i.test(answer.trim())) {
    console.log("Cancelled.");

    return 1;
  }

  return 0;
}
