import type { FunctionComponent } from "preact";

import "./picture.css";

interface PictureProps {
  /** Base path of the variants from `npm run images`, e.g. "/images/portrait". */
  name: string;
  alt: string;
  /** Intrinsic dimensions of one variant, so the browser reserves space before loading. */
  width: number;
  height: number;
  /**
   * Rendered width across viewports, e.g. "(max-width: 47.98rem) 90vw, 20rem".
   * Raw widths only; HTML attributes cannot use the named breakpoints.
   */
  sizes: string;
  /** Variant widths that exist on disk. Must match the manifest entry. */
  widths?: number[];
  /**
   * Variant formats that exist on disk, best first. Must match the manifest
   * entry: the last one renders as the <img> fallback, the rest as <source>
   * elements. Use ["avif", "png"] for images with real transparency.
   */
  formats?: ("avif" | "jpg" | "png" | "webp")[];
  loading?: "lazy" | "eager";
  /** Set "high" on the LCP image so the browser fetches it ahead of other resources. */
  fetchpriority?: "high" | "low" | "auto";
}

const mimeTypes = {
  avif: "image/avif",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const Picture: FunctionComponent<PictureProps> = ({
  name,
  alt,
  width,
  height,
  sizes,
  widths = [480, 960],
  formats = ["avif", "jpg"],
  loading = "lazy",
  fetchpriority,
}) => {
  const sourceSet = (extension: string) =>
    widths.map((w) => `${name}-${w}.${extension} ${w}w`).join(", ");

  const fallback = formats[formats.length - 1];

  return (
    <picture>
      {formats.slice(0, -1).map((format) => (
        <source
          key={format}
          type={mimeTypes[format]}
          srcset={sourceSet(format)}
          sizes={sizes}
        />
      ))}
      <img
        class="picture-image"
        src={`${name}-${widths[widths.length - 1]}.${fallback}`}
        srcset={sourceSet(fallback)}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        fetchpriority={fetchpriority}
        decoding="async"
      />
    </picture>
  );
};
