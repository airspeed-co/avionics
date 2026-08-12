import type { FunctionComponent } from "preact";

import { imageEntry } from "./manifest";

import "./picture.css";

interface PictureProps {
  /** Key in the generated image manifest, e.g. "portrait". */
  name: string;
  alt: string;
  /**
   * Rendered width across viewports, e.g. "(max-width: 47.98rem) 90vw, 20rem".
   * Raw widths only; HTML attributes cannot use the named breakpoints.
   */
  sizes: string;
  loading?: "lazy" | "eager";
  /** Set "high" on the LCP image so the browser fetches it ahead of other resources. */
  fetchpriority?: "high" | "low" | "auto";
}

const mimeTypes: Record<string, string> = {
  avif: "image/avif",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Responsive image rendered entirely from the generated manifest (see
 * ./manifest), so the variants, formats, and intrinsic dimensions always
 * describe files that exist; call sites only choose presentation.
 */
export const Picture: FunctionComponent<PictureProps> = ({
  name,
  alt,
  sizes,
  loading = "lazy",
  fetchpriority,
}) => {
  const { entry, basePath } = imageEntry(name);
  const { widths, formats } = entry;

  const sourceSet = (extension: string) =>
    widths.map((w) => `${basePath}/${name}-${w}.${extension} ${w}w`).join(", ");

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
        src={`${basePath}/${name}-${widths[widths.length - 1]}.${fallback}`}
        srcset={sourceSet(fallback)}
        sizes={sizes}
        alt={alt}
        width={entry.width}
        height={entry.height}
        loading={loading}
        fetchpriority={fetchpriority}
        decoding="async"
      />
    </picture>
  );
};
