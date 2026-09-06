import { render } from "@testing-library/preact";
import { describe, expect, it } from "vitest";

import { provideImageManifest } from "./manifest";
import { Picture } from "./picture";

provideImageManifest({
  basePath: "/images",
  images: {
    portrait: {
      widths: [480, 960],
      formats: ["avif", "jpg"],
      width: 960,
      height: 1200,
      fingerprint: "a",
    },
    "portrait-wide": {
      widths: [640, 1280],
      formats: ["avif", "jpg"],
      width: 1280,
      height: 800,
      fingerprint: "b",
    },
  },
});

describe("Picture", () => {
  it("renders the default entry's formats with the fallback on the img", () => {
    const { container } = render(
      <Picture name="portrait" alt="A portrait" sizes="20rem" />,
    );
    const sources = container.querySelectorAll("source");
    const img = container.querySelector("img");

    expect(sources).toHaveLength(1);
    expect(sources[0].getAttribute("type")).toBe("image/avif");
    expect(sources[0].getAttribute("media")).toBeNull();
    expect(img?.getAttribute("src")).toBe("/images/portrait-960.jpg");
    expect(img?.getAttribute("srcset")).toBe(
      "/images/portrait-480.jpg 480w, /images/portrait-960.jpg 960w",
    );
    expect(img?.getAttribute("width")).toBe("960");
    expect(img?.getAttribute("height")).toBe("1200");
  });

  it("puts art-directed entries first, every format, with their own box", () => {
    const { container } = render(
      <Picture
        name="portrait"
        alt="A portrait"
        sizes="20rem"
        sources={[
          {
            name: "portrait-wide",
            media: "(max-width: 47.98rem)",
            sizes: "100vw",
          },
        ]}
      />,
    );
    const sources = Array.from(container.querySelectorAll("source"));

    expect(sources.map((source) => source.getAttribute("media"))).toEqual([
      "(max-width: 47.98rem)",
      "(max-width: 47.98rem)",
      null,
    ]);
    expect(sources.map((source) => source.getAttribute("type"))).toEqual([
      "image/avif",
      "image/jpeg",
      "image/avif",
    ]);
    expect(sources[0].getAttribute("srcset")).toBe(
      "/images/portrait-wide-640.avif 640w, /images/portrait-wide-1280.avif 1280w",
    );
    expect(sources[0].getAttribute("sizes")).toBe("100vw");
    expect(sources[0].getAttribute("width")).toBe("1280");
    expect(sources[0].getAttribute("height")).toBe("800");
    // The default group keeps the Picture's own sizes.
    expect(sources[2].getAttribute("sizes")).toBe("20rem");
  });

  it("falls back to the Picture's sizes for an art-directed entry without its own", () => {
    const { container } = render(
      <Picture
        name="portrait"
        alt=""
        sizes="20rem"
        sources={[{ name: "portrait-wide", media: "(max-width: 47.98rem)" }]}
      />,
    );

    expect(container.querySelector("source")?.getAttribute("sizes")).toBe(
      "20rem",
    );
  });

  it("fails loudly on an unknown art-directed name", () => {
    expect(() =>
      render(
        <Picture
          name="portrait"
          alt=""
          sizes="20rem"
          sources={[{ name: "nope", media: "(max-width: 47.98rem)" }]}
        />,
      ),
    ).toThrow(/Unknown image "nope"/);
  });
});
