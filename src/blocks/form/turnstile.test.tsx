import "@testing-library/jest-dom/vitest";

import { render, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContactFormCopy } from "../../domain/contact-form";
import { buildContactFormFields } from "../../domain/contact-form";

/*
 * The Turnstile warm-up is deliberately lazy: the widget script loads when
 * the form container nears the viewport, not at hydration, because the
 * challenge's main-thread work was costing real Total Blocking Time on
 * every page load. These tests pin the IntersectionObserver wiring, which
 * no browser-based check can exercise in a hidden tab (observers only fire
 * in rendered pages).
 *
 * The turnstile module caches its script-loading promise at module scope,
 * so each test re-imports a fresh copy of the form (analytics.test.ts uses
 * the same pattern).
 */

const SITE_KEY = "1x00000000000000000000AA";

const copy: ContactFormCopy = {
  labels: {
    name: "Name",
    email: "Email",
    phone: "Phone (optional)",
    message: "Message",
  },
  placeholders: {
    message: "What do you need?",
  },
  submit: "Send message",
  sending: "Sending…",
  success: "Thanks! Your message is on its way.",
  errorFallback: "Something went wrong.",
  verificationFailed: "We couldn't verify your submission. Please try again.",
  validation: {
    required: "This field is required.",
    email: "Invalid email address.",
    min: "{n} characters minimum.",
    max: "{n} characters maximum.",
    words: "Please write a complete message.",
  },
};

const contactFormFields = buildContactFormFields(copy);

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  callback: ObserverCallback;
  options: unknown;
  observed: Element[] = [];

  constructor(callback: ObserverCallback, options?: unknown) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }

  disconnect() {}

  unobserve() {}
}

function turnstileScript() {
  return document.head.querySelector(
    `script[src^="https://challenges.cloudflare.com/turnstile"]`,
  );
}

async function renderFormWithTurnstile() {
  vi.resetModules();

  const { Form } = await import("./form");

  render(
    <Form
      fields={contactFormFields}
      endpoint="/api/contact"
      turnstileSiteKey={SITE_KEY}
    />,
  );
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  document.head.querySelectorAll("script").forEach((script) => script.remove());
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

describe("Turnstile warm-up", () => {
  it("observes the form container instead of loading on mount", async () => {
    await renderFormWithTurnstile();

    expect(turnstileScript()).toBeNull();

    const [observer] = MockIntersectionObserver.instances;

    expect(observer).toBeDefined();
    expect(observer.observed[0]).toHaveClass("form-turnstile");
  });

  it("loads the widget script when the container nears the viewport", async () => {
    await renderFormWithTurnstile();

    const [observer] = MockIntersectionObserver.instances;

    observer.callback([{ isIntersecting: false }]);
    expect(turnstileScript()).toBeNull();

    observer.callback([{ isIntersecting: true }]);
    await waitFor(() => {
      expect(turnstileScript()).not.toBeNull();
    });
  });

  it("warms up immediately when IntersectionObserver is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    await renderFormWithTurnstile();

    await waitFor(() => {
      expect(turnstileScript()).not.toBeNull();
    });
  });
});
