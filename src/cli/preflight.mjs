/*
 * Post-deploy smoke checks: the shared suite (see ../preflight) run with the
 * site's domain from the config's `site` section and the inputs in its
 * `preflight` section. Checks production by default, any origin passed as an
 * argument (a pull request preview URL), or the standing preview deployment
 * with --preview.
 *
 * Usage: avionics preflight [origin | --preview]
 */

import { runPreflight } from "../preflight/index.mjs";

/**
 * The runPreflight options for a config and command-line arguments.
 *
 * @param {import("../config/index.mjs").AvionicsConfig} config
 * @param {import("../config/index.mjs").Site} site
 * @param {string[]} args
 * @returns {import("../preflight/index.mjs").PreflightOptions}
 */
export function preflightOptions(config, site, args) {
  const { previewOrigin, ...options } = config.preflight ?? {};
  const preview = args.includes("--preview");

  if (preview && !previewOrigin) {
    throw new Error(
      "avionics preflight --preview needs preflight.previewOrigin in avionics.config.mjs",
    );
  }

  return {
    ...options,
    productionHost: site.domain,
    origin: preview
      ? previewOrigin
      : args.find((argument) => !argument.startsWith("--")),
    // A config with an analytics section must ship its id; one without has
    // no analytics to verify.
    ...(config.analytics && {
      analyticsMeasurementId: config.analytics.measurementId ?? "",
    }),
  };
}

/**
 * @param {object} context
 * @param {import("../config/index.mjs").AvionicsConfig} context.config
 * @param {import("../config/index.mjs").Site} context.site
 * @param {string[]} context.args
 */
export async function preflight({ config, site, args }) {
  const failures = await runPreflight(preflightOptions(config, site, args));

  return failures === 0 ? 0 : 1;
}
