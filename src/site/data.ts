/*
 * Placeholder the avionics Vite plugin (see ../vite/site-data.mjs) swaps for
 * the site identity resolved from `avionics.config.mjs`: its load hook
 * replaces this module's content, so site code reads the name and domain
 * from the one file that states them. Without the plugin this stays null and
 * ./index.ts throws a pointed error.
 */

import type { Site } from "../config/index.mjs";

const data: Site | null = null;

export default data;
