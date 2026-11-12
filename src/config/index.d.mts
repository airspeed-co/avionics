/*
 * Hand-written types for index.mjs; keep in sync with the JSDoc there (see
 * ../images/index.d.mts for why the implementation stays .mjs).
 */

import type { Format, ImageEntry } from "../images/index.mjs";
import type { PreflightContext } from "../preflight/index.mjs";

/**
 * An image entry plus its output base name (the <Picture> key). A list rather
 * than an object keyed by name, so hyphenated names read like every other one
 * instead of needing quotes.
 */
export type NamedImageEntry = ImageEntry & { name: string };

export interface ImagesConfig {
  /** Directory of original images. */
  sourceDir: string;
  /** Generated-variant directory the engine owns. Default "public/images". */
  outputDir?: string;
  /**
   * URL prefix the output directory is served under. Defaults to `outputDir`
   * with a leading "public/" stripped, e.g. "public/images" -> "/images".
   */
  publicPath?: string;
  /** The images to generate; names must be unique. */
  entries: NamedImageEntry[];
  /** Widths for entries without their own. Default [480, 960]. */
  defaultWidths?: number[];
  /** Formats for entries without their own. Default ["avif", "jpg"]. */
  defaultFormats?: Format[];
}

export interface PrerenderConfig {
  /**
   * Routes not reachable by links, prerendered in addition to everything
   * discovered from the home page.
   */
  routes?: string[];
  /** Selector the app hydrates into. Default "#app". */
  renderTarget?: string;
}

export interface SocialImageConfig {
  /** Served path of the Open Graph image. Default "/og-image.png". */
  path?: string;
  /** Alt text. Defaults to the site name. */
  alt?: string;
  /** Pixel width. Default 1200. */
  width?: number;
  /** Pixel height. Default 630. */
  height?: number;
}

export interface SiteConfig {
  /** The brand name ("Example Co."). */
  name: string;
  /** Apex host of the production site, no scheme or path ("example.com"). */
  domain: string;
  /** Public contact email. */
  email?: string;
  /** Public contact phone. */
  phone?: string;
  /**
   * Locale codes, default locale first; the first is served unprefixed and
   * every other one under "/<code>". Default ["en"].
   */
  locales?: string[];
  /** The Open Graph image. */
  socialImage?: SocialImageConfig;
}

export interface AnalyticsConfig {
  /**
   * GA4 measurement id ("G-XXXXXXXXXX"); preflight verifies a deployed
   * bundle carries it.
   */
  measurementId?: string;
}

export interface PreflightConfig {
  /** POST-only API paths that must reject GET with 405. */
  apiEndpoints?: string[];
  /** Launch redirects to verify, current path -> previous paths. */
  redirects?: Record<string, string[]>;
  /** Paths that must return 200. */
  wellKnownFiles?: string[];
  /** Hosts the served home page may load scripts from, besides its own. */
  allowedScriptHosts?: string[];
  /**
   * The standing preview deployment (`avionics preflight --preview` checks
   * it).
   */
  previewOrigin?: string;
  /** Site-specific checks, run before the summary. */
  extraChecks?: (context: PreflightContext) => Promise<void> | void;
}

export interface ScreensConfig {
  /** Pages to shoot. Defaults to the home page. */
  routes?: { name: string; path: string }[];
  /** Viewports to shoot at. Defaults to one per breakpoint tier. */
  viewports?: { name: string; width: number; height: number }[];
}

export interface PlaceholdersConfig {
  /**
   * Tracked paths (files, or directories ending in "/") that
   * `avionics placeholders` skips.
   */
  ignore?: string[];
}

export interface AvionicsConfig {
  /**
   * The site's identity; the single place the name and domain are written
   * (see resolveSite).
   */
  site?: SiteConfig;
  /** Google Analytics. */
  analytics?: AnalyticsConfig;
  /** Inputs for `avionics preflight`. */
  preflight?: PreflightConfig;
  /** Inputs for `avionics screens`. */
  screens?: ScreensConfig;
  /** Inputs for `avionics placeholders`. */
  placeholders?: PlaceholdersConfig;
  /** The image pipeline (see the images module). */
  images?: ImagesConfig;
  /** Prerendering, wired through the preact preset by the Vite plugin. */
  prerender?: PrerenderConfig;
  /**
   * Stylesheet of shared @custom-media definitions, prepended to every CSS
   * module so Lightning CSS can resolve named breakpoints per file.
   */
  breakpoints?: string;
  /**
   * Browserslist query for CSS targets.
   * Default "defaults, safari >= 15, ios_saf >= 15".
   */
  browsers?: string;
}

/**
 * Identity helper that carries the config type, so editors autocomplete and
 * type-check `avionics.config.mjs` without any annotation in the site file.
 */
export function defineConfig(config: AvionicsConfig): AvionicsConfig;

/**
 * The resolved site identity: the config's `site` section with defaults
 * applied and the values derived from it. This is what the build stamps
 * into pages and what site code imports from "@airspeed-co/avionics/site".
 */
export interface Site {
  name: string;
  domain: string;
  /** Canonical production origin, no trailing slash. */
  origin: string;
  email?: string;
  phone?: string;
  locales: string[];
  socialImage: Required<SocialImageConfig>;
  analyticsMeasurementId?: string;
}

/**
 * Each locale's home prefix: the first (default) locale is unprefixed, every
 * other one lives under its code (["en", "es"] -> ["/", "/es"]).
 */
export function localePrefixes(locales: string[]): string[];

/**
 * Resolves the config's `site` section into the identity everything else
 * derives from, or undefined for a config without one. Throws on a
 * malformed section.
 */
export function resolveSite(config: AvionicsConfig): Site | undefined;
