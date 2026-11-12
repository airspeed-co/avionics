// @vitest-environment node
import { describe, expect, it } from "vitest";

import { resolveSite } from "../config/index.mjs";
import { socialTags } from "./index-html.mjs";
import { robotsTxt } from "./robots.mjs";

const site = /** @type {import("../config/index.mjs").Site} */ (
  resolveSite({ site: { name: "Roots & Co.", domain: "example.com" } })
);

/** @param {import("vite").HtmlTagDescriptor[]} tags */
const contents = (tags) =>
  Object.fromEntries(
    tags.map(({ attrs }) => [attrs?.property ?? attrs?.name, attrs?.content]),
  );

describe("socialTags", () => {
  it("derives every site-wide tag from the site", () => {
    expect(contents(socialTags(site))).toEqual({
      "og:type": "website",
      "og:site_name": "Roots & Co.",
      "og:url": "https://example.com/",
      "og:image": "https://example.com/og-image.png",
      "og:image:type": "image/png",
      "og:image:width": "1200",
      "og:image:height": "630",
      "og:image:alt": "Roots & Co.",
      "twitter:card": "summary_large_image",
      "twitter:image": "https://example.com/og-image.png",
    });
  });

  it("uses property for Open Graph and name for Twitter, all in the head", () => {
    for (const { tag, attrs, injectTo } of socialTags(site)) {
      const key = attrs?.property ?? attrs?.name;

      expect(tag).toBe("meta");
      expect(injectTo).toBe("head");
      expect("property" in (attrs ?? {})).toBe(`${key}`.startsWith("og:"));
    }
  });

  it("follows a custom image and omits the type it cannot name", () => {
    const tags = contents(
      socialTags({
        ...site,
        socialImage: { path: "/share.jpg", alt: "A", width: 800, height: 400 },
      }),
    );

    expect(tags["og:image"]).toBe("https://example.com/share.jpg");
    expect(tags["og:image:type"]).toBe("image/jpeg");
    expect(tags["og:image:width"]).toBe("800");

    expect(
      contents(
        socialTags({
          ...site,
          socialImage: { ...site.socialImage, path: "/share.gif" },
        }),
      ),
    ).not.toHaveProperty("og:image:type");
  });
});

describe("robotsTxt", () => {
  it("allows everything and names the sitemap on the site's origin", () => {
    expect(robotsTxt("https://example.com")).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml\n",
    );
  });
});
