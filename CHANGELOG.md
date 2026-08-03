# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-02

### Added

- Airframe entry point (`./airframe`): the shared container layer for prerendered MPA sites with instant client-side navigation.
  - `createSiteEntry` wires a site's entry module: hydrates the app, enables client navigation, and returns the `prerender` function with head baking.
  - `enableClientNavigation` intercepts internal page-link clicks and re-renders the app in place (unanimated, native-app feel); non-page links, downloads, modified clicks, and external origins keep browser behavior.
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

[0.2.0]: https://github.com/airspeed-co/avionics/releases/tag/v0.2.0
[0.1.0]: https://github.com/airspeed-co/avionics/releases/tag/v0.1.0
