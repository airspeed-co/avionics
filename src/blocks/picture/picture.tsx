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
  /** Variant widths that exist on disk. Must match the script's widths. */
  widths?: number[];
  loading?: "lazy" | "eager";
  /** Set "high" on the LCP image so the browser fetches it ahead of other resources. */
  fetchpriority?: "high" | "low" | "auto";
}

export const Picture: FunctionComponent<PictureProps> = ({
  name,
  alt,
  width,
  height,
  sizes,
  widths = [480, 960],
  loading = "lazy",
  fetchpriority,
}) => {
  const sourceSet = (extension: string) =>
    widths.map((w) => `${name}-${w}.${extension} ${w}w`).join(", ");

  return (
    <picture>
      <source type="image/avif" srcset={sourceSet("avif")} sizes={sizes} />
      <img
        class="picture-image"
        src={`${name}-${widths[widths.length - 1]}.jpg`}
        srcset={sourceSet("jpg")}
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
