# @airspeed-co/avionics

Shared internal systems for [Airspeed Co.](https://airspeed.co) websites: form blocks, validation, prerender head baking, and the Cloudflare Worker contact handler. Every Airspeed site is its own airframe — theme, pages, copy — and they all fly the same avionics.

Ships raw Preact + TypeScript source with no build step: the consuming site's Vite compiles it with the site's own JSX, CSS, and breakpoint settings.

## Install

```bash
npm install @airspeed-co/avionics preact preact-iso
```

`preact` and `preact-iso` are peer dependencies; the site must provide exactly one copy of preact or hooks break.

## Entry points

One level deep, one entry per runtime concern. `blocks` and `hooks` are browser-only (preact, CSS); `domain` and `utils` are pure and safe in both runtimes; `worker` is worker-only. They stay separate so the Worker bundle never pulls preact or CSS, and importing a helper never drags block styles along.

| Import                           | Contents                                                                                                   |
| :------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `@airspeed-co/avionics/blocks`   | `Button`, `Form`, `FormField`, `Picture`                                                                   |
| `@airspeed-co/avionics/domain`   | `FieldConfig`, `Validation`, `validateForm`, `buildContactFormFields`, contact form types                  |
| `@airspeed-co/avionics/hooks`    | `useTitle`, `useDescription`, `useJsonLd`, `useNoindex`, `useAlternateLanguage`, prerender capture helpers |
| `@airspeed-co/avionics/utils`    | `classNames`, validation factories (required, email, length, words)                                        |
| `@airspeed-co/avionics/worker`   | `createContactHandler`, `sendEmail`, `verifyTurnstile`, `rewriteOpenGraph`, `ContactEnv`                   |
| `@airspeed-co/avionics/airframe` | `createSiteEntry`, `definePages`, `enableClientNavigation`                                                 |
| `@airspeed-co/avionics/config`   | `defineConfig` for `avionics.config.mjs`, `resolveSite`, `localePrefixes`                                  |
| `@airspeed-co/avionics/site`     | `site`: the identity from the config's `site` section (name, domain, origin, contact details, locales)     |
| `@airspeed-co/avionics/vite`     | `avionics` (the Vite preset), `avionicsSite` (site data for a vitest config)                               |

## Airframe

The container layer: full-hydration MPA with instant client navigation. Every route prerenders to static HTML (SEO and first loads never depend on JavaScript); after hydration, clicks on internal page links re-render the app in place with no animation, like a native app, while non-page links, downloads, and modified clicks keep browser behavior. A site's entry module becomes configuration:

```tsx
// site: src/routes.tsx
export const { resolvePage, isPageRoute } = definePages(
  { "/": Home, "/contact": Contact },
  NotFound,
);

// site: src/index.tsx
export const { prerender } = createSiteEntry({
  renderApp: (url) => <App url={url} />,
  defaultTitle: formatTitle(),
  isPageRoute: (pathname) => isPageRoute(splitLocale(pathname).pathname),
  localeOf: (url) => splitLocale(url).locale,
});
```

## One file describes the site

The `site` section of `avionics.config.mjs` is the only place a site's name and domain are written. Everything else derives from it:

```js
// site: avionics.config.mjs
import { defineConfig } from "@airspeed-co/avionics/config";

import { endpoints } from "./src/domain/endpoints.ts";

export default defineConfig({
  site: {
    name: "Example Co.",
    domain: "example.com",
    email: "hello@example.com",
    phone: "555-555-5555",
    locales: ["en", "es"], // default locale first; defaults to ["en"]
  },
  analytics: { measurementId: "G-XXXXXXXXXX" },
  preflight: { apiEndpoints: Object.values(endpoints) },
});
```

With a `site` section, the Vite preset:

- emits `robots.txt` (delete `public/robots.txt`);
- injects the site-wide Open Graph and Twitter tags into `index.html` (delete them there; `site.socialImage` overrides the image path, alt text, and size);
- defaults the sitemap's origin and locale prefixes, so `vite.config.ts` passes only `sitemap: { paths }`;
- serves the resolved identity to site code, in the browser bundle and the Worker alike:

```ts
// site: src/config/site.ts
import { site } from "@airspeed-co/avionics/site";

export const siteName = site.name;
export const canonicalOrigin = site.origin; // "https://example.com"
```

Tests do not load the preset, so a site's `vitest.config.ts` adds `avionicsSite()` from `@airspeed-co/avionics/vite` to its plugins. The config is loaded by plain Node, so it can import the site's own `.ts` modules (with the `.ts` extension) to reuse values such as the API endpoints. Editing the `site` section needs a dev server restart.

A config without a `site` section builds exactly as before, so sites adopt it one at a time.

## Commands

The tooling every site shares ships as the `avionics` command, run from the site root and driven by the config, so no site keeps its own copy of these scripts:

| Command                               | What it does                                                                                                               |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------- |
| `avionics preflight [origin]`         | Post-deploy smoke checks against production, any origin, or `--preview` (the config's `preflight.previewOrigin`)           |
| `avionics pagespeed [origin]`         | PageSpeed Insights scores for production or any public origin; needs `PAGESPEED_API_KEY` in `.env`                         |
| `avionics screens`                    | Screenshot contact sheet of the built site in `screens/`; routes and viewports from the config's `screens` section         |
| `avionics favicons`                   | Regenerates `favicon-32.png` and `apple-touch-icon.png` from `public/favicon.svg`                                          |
| `avionics build`                      | The Cloudflare Workers Builds command: `npm run build` on `main`, `npm run build:staging` on every other branch            |
| `avionics confirm-deploy [--env <n>]` | Prints the worker and domains about to be published and asks first                                                         |
| `avionics placeholders`               | Fails if `example.com` or `TODO(template)` is left in a tracked file; `placeholders.ignore` in the config lists exceptions |

A site's `package.json` scripts call them:

```json
{
  "build:ci": "avionics build",
  "screens": "npm run build && avionics screens",
  "deploy": "avionics confirm-deploy && npm run build && wrangler deploy",
  "preflight": "avionics preflight",
  "preflight:preview": "avionics preflight --preview",
  "pagespeed": "avionics pagespeed",
  "favicons": "avionics favicons"
}
```

`screens` and `favicons` use the site's own `playwright` and `sharp`. `placeholders` passes in the template repo itself, where `site.domain` is still `example.com`; add it to a client site's `verify` script.

## What the site owns

**Visual CSS.** Blocks render stable class names and ship only functional CSS (the picture layout). The site styles these hooks in its own stylesheets:

- `Button`: `.button`, `.button-primary`, `.button-inverted`
- `Form`: `.form`, `.form-submit`, `.form-error`, `.form-success`, `.form-turnstile` (empty unless the bot check needs a click; give it a margin)
- `FormField`: `.field`, `.field-error`, `.field-error-message`

**Images.** `Picture` renders one manifest entry; pass `sources` (`{ name, media, sizes? }`) for art direction, each a separate manifest entry with its own crop (two entries may share a source file), rendered as `<source media>` groups the browser resolves before fetching. Manifest drift (an entry whose file is missing, a file no entry claims) fails the build; the dev server warns instead, prints an entry to paste for each unclaimed file, and keeps serving the last good manifest when a regeneration fails.

**Titles.** `useTitle` takes the finished document title; keep a `formatTitle` helper in the site's config. `resetServerHead(defaultTitle)` takes the default for the same reason.

**Contact form copy and wiring.** `buildContactFormFields(copy)` takes the site's `ContactFormCopy` strings (per locale) and returns the field configs used by both the `Form` UI and the Worker:

```ts
// site: src/domain/contact-form.ts
export const contactFormFields = buildContactFormFields(en.contactForm);

// site: src/worker/index.ts
const handleContact = createContactHandler(contactFormFields);
```

**Env bindings.** The Worker handler needs `CONTACT_FROM`, `CONTACT_TO`, optional `CONTACT_FROM_NAME` (wrangler `vars`) and the `RESEND_API_KEY` and `TURNSTILE_SECRET_KEY` secrets; without the Resend key (local dev) it logs the email instead of sending, and without the Turnstile secret it accepts submissions unverified and says so in the worker log. A site's wrangler-generated `Env` satisfies `ContactEnv` structurally.

**Bot protection.** The form uses [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/), not a honeypot: honeypots get filled by browser autofill and then have to fake success to keep bots guessing, which silently drops real people. Pass the widget's public site key as `turnstileSiteKey` on `Form`; the block loads the script on demand, runs an invisible challenge at submit, and sends the token; the handler verifies it with `TURNSTILE_SECRET_KEY` before doing anything else. Nothing is ever silently dropped: a missing or rejected token, or a challenge that could not run, shows the site's `verificationFailed` copy (from `ContactFormCopy`, so it can name the phone number or email to use instead) and the visitor can retry. One widget can list every hostname a site runs on (apex, preview subdomain, `*.workers.dev`, `localhost`); for dev and CI without a widget, `TURNSTILE_TEST_SITE_KEY` and `TURNSTILE_TEST_SECRET_KEY` are Cloudflare's always-pass pair.

## Versioning

Semver. Sites pin `^major.minor` and update deliberately, one site at a time; a fix ships as a patch here, then each site bumps, runs its checks and screenshot sheets, and deploys on its own schedule.
