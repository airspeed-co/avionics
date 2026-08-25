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

## What the site owns

**Visual CSS.** Blocks render stable class names and ship only functional CSS (the picture layout). The site styles these hooks in its own stylesheets:

- `Button`: `.button`, `.button-primary`, `.button-inverted`
- `Form`: `.form`, `.form-submit`, `.form-error`, `.form-success`, `.form-turnstile` (empty unless the bot check needs a click; give it a margin)
- `FormField`: `.field`, `.field-error`, `.field-error-message`

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
