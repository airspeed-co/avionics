# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.21.0] - 2026-11-12

### Added

- A `site` section in `avionics.config.mjs`: the one place a site's name, domain, contact email, phone, and locales are written.
- With a `site` section, the Vite preset emits `robots.txt`, injects the site-wide Open Graph and Twitter tags, and defaults the sitemap's origin and locale prefixes.
- `@airspeed-co/avionics/site` exports the resolved `site` to site code, in the browser bundle and the Worker. `avionicsSite()` from `@airspeed-co/avionics/vite` supplies it in tests.
- The `avionics` command, replacing the scripts each site copied: `preflight`, `pagespeed`, `screens`, `favicons`, `build`, `confirm-deploy`, and the new `placeholders` check.
- `runPreflight` takes `analyticsMeasurementId` and verifies a deployed bundle carries it.

### Fixed

- `screens` no longer hangs on pages with lazy images far below the fold.

### Adopting it in a site

Sites without a `site` section build as before, so each site adopts this on its own schedule:

1. Add `site` (and `analytics`, `preflight`) to `avionics.config.mjs`. The README has an example.
2. In `src/config/site.ts`, read the name, origin, email, phone, and measurement id from `site` (`import { site } from "@airspeed-co/avionics/site"`). `site.email` and `site.phone` are optional, so a site that shows them either renders them only when present or keeps its own constants.
3. Delete `public/robots.txt` and the Open Graph and Twitter tags in `index.html`.
4. In `vite.config.ts`, pass only `sitemap: { paths }`.
5. In `vitest.config.ts`, add `avionicsSite()` to the plugins.
6. Point the `package.json` scripts at the `avionics` commands (see the README), then delete `scripts/preflight.mjs`, `pagespeed.mjs`, `screens.*`, `generate-favicons.mjs`, `build.mjs`, and `confirm-deploy.mjs`. `comment-json` can go too if nothing else uses it.

## [0.2.0] - 2026-08-02

### Added

- Airframe entry point (`./airframe`): the shared container layer for prerendered MPA sites with instant client-side navigation.
  - `createSiteEntry` wires a site's entry module: hydrates the app, enables client navigation, and returns the `prerender` function with head baking.
  - `enableClientNavigation` intercepts internal page-link clicks and re-renders the app in place; non-page links, downloads, modified clicks, and external origins keep browser behavior. Swaps land at the top instantly like a real page load; hash links then scroll to their target with the site's CSS scroll-behavior deciding the feel. The html lang follows the locale across swaps (`localeOf`).
  - `definePages` builds `resolvePage`/`isPageRoute` from a pathname → component map.
- `preact-iso` is now a peer dependency (used by `createSiteEntry` for prerendering).

## [0.1.0] - 2026-08-01

Initial release, extracted from the airspeed.co website.

### Added

- `Button`, `Form`, `FormField`, and `Picture` blocks with functional CSS only; visual styling stays with the site (see the class contract in the README).
- Form domain: `FieldConfig`, `validateForm`, and the contact form config (`buildContactFormFields`, per-locale `ContactFormCopy`).
- Validation factories: required, email, length, and words (spam gibberish filter).
- Prerender head baking hooks: `useTitle`, `useDescription`, `useJsonLd`, `useNoindex`, `useAlternateLanguage`, plus server capture helpers.
- Cloudflare Worker contact handler: `createContactHandler`, `sendEmail` (Resend), `rewriteOpenGraph`.
- Five entry points, one level deep, one per runtime concern: `./blocks`, `./domain`, `./hooks`, `./utils`, `./worker`.

[0.21.0]: https://github.com/airspeed-co/avionics/releases/tag/v0.21.0
[0.2.0]: https://github.com/airspeed-co/avionics/releases/tag/v0.2.0
[0.1.0]: https://github.com/airspeed-co/avionics/releases/tag/v0.1.0
