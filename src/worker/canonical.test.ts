import { describe, expect, it } from "vitest";

import { createCanonicalRedirect } from "./canonical";

const canonicalRedirect = createCanonicalRedirect("https://example.com");
const location = (url: string) =>
  canonicalRedirect(new URL(url))?.headers.get("location");

describe("createCanonicalRedirect", () => {
  it("301s www to the apex, keeping path and query", () => {
    const response = canonicalRedirect(new URL("https://www.example.com/?q=1"));

    expect(response?.status).toBe(301);
    expect(response?.headers.get("location")).toBe("https://example.com/?q=1");
  });

  it("upgrades http on the apex to https", () => {
    expect(location("http://example.com/es/work")).toBe(
      "https://example.com/es/work",
    );
  });

  it("collapses http www in one hop", () => {
    expect(location("http://www.example.com/")).toBe("https://example.com/");
  });

  it("leaves the canonical origin alone", () => {
    expect(canonicalRedirect(new URL("https://example.com/"))).toBeUndefined();
  });

  it("leaves other hosts alone, http or https", () => {
    for (const url of [
      "http://localhost:5173/",
      "https://preview.example.com/",
      "http://preview.example.com/",
      "https://site.account.workers.dev/",
      "https://abc123-site.account.workers.dev/",
    ]) {
      expect(canonicalRedirect(new URL(url))).toBeUndefined();
    }
  });
});
