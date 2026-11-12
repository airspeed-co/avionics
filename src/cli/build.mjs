/*
 * Build command for Cloudflare Workers Builds, which runs one command for
 * every branch. Picks the site's npm script from the branch Workers Builds
 * injects: `main` builds production (the custom domain, indexable); every
 * other branch (develop, pull requests) builds staging (noindex, preview
 * URLs).
 */

import { execFileSync } from "node:child_process";

/**
 * The npm script to run for a branch.
 *
 * @param {string} branch
 */
export const buildScript = (branch) =>
  branch === "main" ? "build" : "build:staging";

/** @param {{ cwd: string }} context */
export async function build({ cwd }) {
  const branch = process.env.WORKERS_CI_BRANCH ?? "";
  const script = buildScript(branch);

  console.log(`[avionics build] branch="${branch}" -> npm run ${script}`);

  execFileSync("npm", ["run", script], { cwd, stdio: "inherit" });

  return 0;
}
