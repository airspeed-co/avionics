import { describe, expect, it } from "vitest";

import { createRedirects } from "./redirects";

const origin = "https://example.com";
const url = (path: string) => new URL(`${origin}${path}`);

describe("createRedirects", () => {
  const redirect = createRedirects({
    "/services": ["/what-we-offer", "/offerings"],
    "/#contact": ["/contact"],
    "/": ["/home"],
  });

  it("301s a previous path to its current path", () => {
    const response = redirect(url("/what-we-offer"))!;

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(`${origin}/services`);
  });

  it("maps multiple previous paths to one target", () => {
    expect(redirect(url("/offerings"))!.headers.get("location")).toBe(
      `${origin}/services`,
    );
  });

  it("matches with a trailing slash", () => {
    expect(redirect(url("/what-we-offer/"))!.headers.get("location")).toBe(
      `${origin}/services`,
    );
  });

  it("carries the query string to the target", () => {
    expect(
      redirect(url("/what-we-offer?utm_source=x"))!.headers.get("location"),
    ).toBe(`${origin}/services?utm_source=x`);
  });

  it("supports a fragment on the target", () => {
    expect(redirect(url("/contact"))!.headers.get("location")).toBe(
      `${origin}/#contact`,
    );
  });

  it("redirects to the root", () => {
    expect(redirect(url("/home"))!.headers.get("location")).toBe(`${origin}/`);
  });

  it("returns null for paths that are not previous paths", () => {
    expect(redirect(url("/services"))).toBeNull();
    expect(redirect(url("/anything-else"))).toBeNull();
  });

  it("rejects a previous path claimed by two targets", () => {
    expect(() => createRedirects({ "/a": ["/old"], "/b": ["/old"] })).toThrow(
      /points at both/,
    );
  });

  it("rejects a previous path that is itself a target", () => {
    expect(() => createRedirects({ "/a": ["/b"], "/b": ["/c"] })).toThrow(
      /itself a redirect target/,
    );
  });

  it("rejects relative paths", () => {
    expect(() => createRedirects({ "/a": ["old"] })).toThrow(/start with/);
    expect(() => createRedirects({ a: ["/old"] })).toThrow(/start with/);
  });
});
