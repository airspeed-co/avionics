// @vitest-environment node
import { describe, expect, it } from "vitest";

import { localePrefixes, resolveSite } from "./index.mjs";

describe("resolveSite", () => {
  it("returns undefined for a config without a site section", () => {
    expect(resolveSite({})).toBeUndefined();
  });

  it("derives the origin and applies the defaults", () => {
    expect(
      resolveSite({ site: { name: "Example Co.", domain: "example.com" } }),
    ).toEqual({
      name: "Example Co.",
      domain: "example.com",
      origin: "https://example.com",
      locales: ["en"],
      socialImage: {
        path: "/og-image.png",
        alt: "Example Co.",
        width: 1200,
        height: 630,
      },
    });
  });

  it("carries the contact details, locales, and measurement id", () => {
    expect(
      resolveSite({
        site: {
          name: "Example Co.",
          domain: "shop.example.com",
          email: "hello@example.com",
          phone: "555-555-5555",
          locales: ["en", "es"],
          socialImage: { alt: "Example Co. wordmark" },
        },
        analytics: { measurementId: "G-TEST" },
      }),
    ).toMatchObject({
      origin: "https://shop.example.com",
      email: "hello@example.com",
      phone: "555-555-5555",
      locales: ["en", "es"],
      socialImage: { path: "/og-image.png", alt: "Example Co. wordmark" },
      analyticsMeasurementId: "G-TEST",
    });
  });

  it.each([
    "https://example.com",
    "example.com/",
    "Example.com",
    "example",
    "www.example.com/about",
    "",
  ])("rejects the domain %j", (domain) => {
    expect(() =>
      resolveSite({ site: { name: "Example Co.", domain } }),
    ).toThrow(/site\.domain/);
  });

  it("rejects a missing name and an empty locale list", () => {
    expect(() =>
      resolveSite({ site: { name: " ", domain: "example.com" } }),
    ).toThrow(/site\.name/);
    expect(() =>
      resolveSite({
        site: { name: "Example Co.", domain: "example.com", locales: [] },
      }),
    ).toThrow(/site\.locales/);
  });
});

describe("localePrefixes", () => {
  it("serves the first locale unprefixed and the rest under their code", () => {
    expect(localePrefixes(["en"])).toEqual(["/"]);
    expect(localePrefixes(["en", "es", "fr"])).toEqual(["/", "/es", "/fr"]);
  });
});
