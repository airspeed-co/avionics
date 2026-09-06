import type { FunctionComponent } from "preact";

import { imageEntry } from "./manifest";

import "./picture.css";

/**
 * An alternative manifest entry for part of the viewport range: a different
 * crop of the same subject (a landscape cut for phones, say). Declared in the
 * manifest like any entry, typically from the same source file.
 */
export interface ArtDirectedSource {
  /** Key in the generated image manifest. */
  name: string;
  /** Media query under which this entry is used, e.g. "(max-width: 47.98rem)". */
  media: string;
  /** Rendered width under that media query; defaults to the Picture's sizes. */
  sizes?: string;
}

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
  /**
   * Art direction: entries to use instead of `name` while their media query
   * matches, first match wins. Rendered as <source media> groups ahead of the
   * default entry, so the browser picks one before fetching anything; two
   * <Picture>s toggled with CSS would both download.
   */
  sources?: ArtDirectedSource[];
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
  sources = [],
}) => {
  const { entry, basePath } = imageEntry(name);
  const { widths, formats } = entry;

  const sourceSet = (
    entryName: string,
    entryWidths: number[],
    extension: string,
  ) =>
    entryWidths
      .map((w) => `${basePath}/${entryName}-${w}.${extension} ${w}w`)
      .join(", ");

  const fallback = formats[formats.length - 1];

  return (
    <picture>
      {/* Art-directed entries list every format, fallback included: a matched
          media group must stand on its own. Width and height ride along so
          the browser reserves the right box before the bytes arrive. */}
      {sources.map((source) => {
        const alternate = imageEntry(source.name).entry;

        return alternate.formats.map((format) => (
          <source
            key={`${source.name}-${format}`}
            media={source.media}
            type={mimeTypes[format]}
            srcset={sourceSet(source.name, alternate.widths, format)}
            sizes={source.sizes ?? sizes}
            width={alternate.width}
            height={alternate.height}
          />
        ));
      })}
      {formats.slice(0, -1).map((format) => (
        <source
          key={format}
          type={mimeTypes[format]}
          srcset={sourceSet(name, widths, format)}
          sizes={sizes}
        />
      ))}
      <img
        class="picture-image"
        src={`${basePath}/${name}-${widths[widths.length - 1]}.${fallback}`}
        srcset={sourceSet(name, widths, fallback)}
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
