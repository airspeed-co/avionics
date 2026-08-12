/*
 * Placeholder the avionics Vite plugin (see ../../vite) swaps for the
 * generated image manifest: its load hook replaces this module's content
 * with the manifest JSON the image engine wrote, so <Picture> renders from
 * generated truth with no site wiring. Without the plugin this stays null
 * and imageEntry (see ./manifest.ts) throws a pointed error, unless the
 * site registered a manifest manually via provideImageManifest.
 */

/** @type {import("./manifest").ImageManifest | null} */
export default null;
