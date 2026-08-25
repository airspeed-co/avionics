// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://airspeed.co/"}
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The analytics gates decide whether measurement runs at all, and a
 * silently wrong gate either pollutes the data or drops it for weeks
 * before anyone notices. The module keeps "active" state at module scope,
 * so each test re-imports a fresh copy.
 */

const ORIGIN = "https://airspeed.co";
const MEASUREMENT_ID = "G-TEST123456";

async function loadAnalytics() {
  vi.resetModules();

  return await import("./index");
}

function gtagScript() {
  return document.head.querySelector(
    `script[src^="https://www.googletagmanager.com/gtag/js"]`,
  );
}

function pushedEntries() {
  return (window.dataLayer ?? []).map((entry) =>
    Array.from(entry as ArrayLike<unknown>),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.head.querySelectorAll("script").forEach((script) => script.remove());
  delete window.dataLayer;
  delete window.gtag;
  history.replaceState(null, "", "/");
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("initAnalytics", () => {
  it("does nothing without a measurement id", async () => {
    const { initAnalytics } = await loadAnalytics();

    initAnalytics({ origin: ORIGIN });

    expect(gtagScript()).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });

  it("does nothing when the page is not on the canonical origin", async () => {
    const { initAnalytics } = await loadAnalytics();

    initAnalytics({
      measurementId: MEASUREMENT_ID,
      origin: "https://example.com",
    });

    expect(gtagScript()).toBeNull();
  });

  it("loads gtag and records config on the canonical origin", async () => {
    const { initAnalytics } = await loadAnalytics();

    initAnalytics({ measurementId: MEASUREMENT_ID, origin: ORIGIN });

    expect(gtagScript()?.getAttribute("src")).toContain(MEASUREMENT_ID);
    expect(pushedEntries()).toContainEqual(["config", MEASUREMENT_ID]);
  });

  it("?analytics=off opts the browser out, and it persists", async () => {
    history.replaceState(null, "", "/?analytics=off");

    const first = await loadAnalytics();

    first.initAnalytics({ measurementId: MEASUREMENT_ID, origin: ORIGIN });
    expect(gtagScript()).toBeNull();

    // A later plain visit stays excluded.
    history.replaceState(null, "", "/");

    const second = await loadAnalytics();

    second.initAnalytics({ measurementId: MEASUREMENT_ID, origin: ORIGIN });
    expect(gtagScript()).toBeNull();
  });

  it("?analytics=on clears the opt-out", async () => {
    localStorage.setItem("analytics", "off");
    history.replaceState(null, "", "/?analytics=on");

    const { initAnalytics } = await loadAnalytics();

    initAnalytics({ measurementId: MEASUREMENT_ID, origin: ORIGIN });

    expect(localStorage.getItem("analytics")).toBeNull();
    expect(gtagScript()).not.toBeNull();
  });
});

describe("trackEvent", () => {
  it("drops events while analytics is off", async () => {
    const { trackEvent } = await loadAnalytics();

    trackEvent("generate_lead", { form: "audit" });

    expect(window.dataLayer).toBeUndefined();
  });

  it("records events once analytics is active", async () => {
    const { initAnalytics, trackEvent } = await loadAnalytics();

    initAnalytics({ measurementId: MEASUREMENT_ID, origin: ORIGIN });
    trackEvent("generate_lead", { form: "audit" });

    expect(pushedEntries()).toContainEqual([
      "event",
      "generate_lead",
      { form: "audit" },
    ]);
  });
});
