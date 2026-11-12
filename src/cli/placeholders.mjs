/*
 * Fails when template placeholders are left in a client repo: the reserved
 * domain the template ships with, and the TODO marker on every value a new
 * site must replace. Scans the files git tracks, so build output and
 * node_modules never count.
 *
 * The template itself is the one repo where the placeholders belong, so the
 * check passes there (its `site.domain` is still the reserved domain).
 * Paths listed in the config's `placeholders.ignore` are skipped.
 *
 * Usage: avionics placeholders
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/** The domain the template ships with (reserved for documentation). */
export const TEMPLATE_DOMAIN = "example.com";

const patterns = [
  { label: TEMPLATE_DOMAIN, expression: /example\.com/i },
  { label: "TODO(template)", expression: /TODO\(template\)/ },
];

/** Lockfiles name registry hosts and are not hand-edited. */
const defaultIgnore = ["package-lock.json"];

/**
 * @typedef {object} PlaceholderHit
 * @property {string} file
 * @property {number} line 1-based
 * @property {string} label which placeholder matched
 */

/**
 * Every placeholder in one file's text.
 *
 * @param {string} file
 * @param {string} text
 * @returns {PlaceholderHit[]}
 */
export function findPlaceholders(file, text) {
  /** @type {PlaceholderHit[]} */
  const hits = [];

  text.split("\n").forEach((content, index) => {
    for (const { label, expression } of patterns) {
      if (expression.test(content)) {
        hits.push({ file, line: index + 1, label });
      }
    }
  });

  return hits;
}

/**
 * Whether a tracked path is covered by an ignore list of files and
 * directories (entries ending in "/").
 *
 * @param {string} file
 * @param {string[]} ignore
 */
export const isIgnored = (file, ignore) =>
  ignore.some((entry) =>
    entry.endsWith("/") ? file.startsWith(entry) : file === entry,
  );

/**
 * @param {object} context
 * @param {string} context.cwd
 * @param {import("../config/index.mjs").AvionicsConfig} context.config
 * @param {import("../config/index.mjs").Site} context.site
 */
export async function placeholders({ cwd, config, site }) {
  if (site.domain === TEMPLATE_DOMAIN) {
    console.log(
      `[avionics placeholders] skipped: site.domain is ${TEMPLATE_DOMAIN}, so this is the template`,
    );

    return 0;
  }

  const ignore = [...defaultIgnore, ...(config.placeholders?.ignore ?? [])];
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => file && !isIgnored(file, ignore));

  /** @type {PlaceholderHit[]} */
  const hits = [];

  for (const file of files) {
    /** @type {Buffer} */
    let buffer;

    try {
      buffer = readFileSync(path.join(cwd, file));
    } catch {
      // Tracked but deleted in the working tree.
      continue;
    }

    // A NUL byte marks a binary file (images, fonts).
    if (buffer.includes(0)) continue;

    hits.push(...findPlaceholders(file, buffer.toString("utf8")));
  }

  for (const { file, line, label } of hits) {
    console.log(`${file}:${line}  ${label}`);
  }

  console.log(
    hits.length === 0
      ? `[avionics placeholders] none left in ${files.length} tracked files`
      : `\n${hits.length} template placeholder(s) left; replace each one, or list the path under placeholders.ignore in avionics.config.mjs if it is intended`,
  );

  return hits.length === 0 ? 0 : 1;
}
