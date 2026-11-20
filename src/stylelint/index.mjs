/*
 * The CSS property order every Airspeed site shares. Plain ESM with no build
 * step and no TypeScript, because stylelint loads its config itself: it never
 * passes through the site's Vite or tsc.
 *
 * A site's stylelint.config.mjs re-exports this as-is, or spreads it to add
 * its own rules (see the README).
 */

// @ts-ignore -- neither package ships type declarations
import stylelintOrder from "stylelint-order";
// @ts-ignore
import untypedPropertyGroups from "stylelint-config-recess-order/groups";

/** @type {Array<{ properties: string[] }>} */
const propertyGroups = untypedPropertyGroups;

// Recess keeps ~40 fine-grained groups; merge them into three stanzas
// (layout/box, text, surface/misc) separated by blank lines. Three stanzas a
// reader can hold in their head beat forty they have to look up.
const textStart = propertyGroups.findIndex((group) =>
  group.properties.includes("font"),
);
const surfaceStart = propertyGroups.findIndex((group) =>
  group.properties.includes("cursor"),
);

/**
 * @param {{ properties: string[] }[]} groups
 * @param {"always" | "never"} emptyLineBefore
 */
const stanza = (groups, emptyLineBefore) => ({
  properties: groups.flatMap((group) => group.properties),
  emptyLineBefore,
  noEmptyLineBetween: true,
});

export default {
  // The plugin module itself, not its name: stylelint resolves a name from
  // the site's config file, where this package's own dependency may not be
  // reachable.
  plugins: [stylelintOrder],
  rules: {
    "order/properties-order": [
      [
        stanza(propertyGroups.slice(0, textStart), "never"),
        stanza(propertyGroups.slice(textStart, surfaceStart), "always"),
        stanza(propertyGroups.slice(surfaceStart), "always"),
      ],
      {
        // Custom properties and anything Recess does not know about collect
        // in their own stanza at the end rather than failing the lint.
        unspecified: "bottom",
        emptyLineBeforeUnspecified: "always",
      },
    ],
  },
};
