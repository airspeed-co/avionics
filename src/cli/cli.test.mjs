// @vitest-environment node
import { describe, expect, it } from "vitest";

import { resolveSite } from "../config/index.mjs";
import { buildScript } from "./build.mjs";
import { deployTarget } from "./confirm-deploy.mjs";
import { parseJsonc } from "./jsonc.mjs";
import { findPlaceholders, isIgnored } from "./placeholders.mjs";
import { preflightOptions } from "./preflight.mjs";
import { defaultRoutes } from "./screens.mjs";

describe("parseJsonc", () => {
  it("drops comments and trailing commas", () => {
    expect(
      parseJsonc(`{
        // line comment
        "name": "site", /* block
        comment */
        "list": [1, 2, ],
        "env": { "preview": { "workers_dev": true, }, },
      }`),
    ).toEqual({
      name: "site",
      list: [1, 2],
      env: { preview: { workers_dev: true } },
    });
  });

  it("leaves comment and comma look-alikes inside strings alone", () => {
    expect(
      parseJsonc(`{ "url": "https://a.test/x", "odd": "a,}/*b*/\\"c" }`),
    ).toEqual({ url: "https://a.test/x", odd: 'a,}/*b*/"c' });
  });
});

describe("deployTarget", () => {
  const config = {
    name: "website-a",
    routes: [{ pattern: "a.test", custom_domain: true }],
    env: { preview: { workers_dev: true }, named: { name: "other" } },
  };

  it("reads the top level as production", () => {
    expect(deployTarget(config)).toEqual({
      worker: "website-a",
      targets: ["a.test"],
    });
  });

  it("names an environment's worker and its workers.dev URL", () => {
    expect(deployTarget(config, "preview")).toEqual({
      worker: "website-a-preview",
      targets: ["its workers.dev URL"],
    });
    expect(deployTarget(config, "named").worker).toBe("other");
  });
});

describe("buildScript", () => {
  it("builds production on main and staging everywhere else", () => {
    expect(buildScript("main")).toBe("build");
    expect(buildScript("develop")).toBe("build:staging");
    expect(buildScript("")).toBe("build:staging");
  });
});

describe("findPlaceholders", () => {
  it("reports each placeholder with its line", () => {
    expect(
      findPlaceholders(
        "src/config.ts",
        [
          "// TODO(template): set the id",
          "const id = 1;",
          'const mail = "hello@Example.com";',
        ].join("\n"),
      ),
    ).toEqual([
      { file: "src/config.ts", line: 1, label: "TODO(template)" },
      { file: "src/config.ts", line: 3, label: "example.com" },
    ]);
  });

  it("passes text without placeholders, including look-alikes", () => {
    expect(
      findPlaceholders("a.ts", "// TODO(photos): replace\nexample-com.test"),
    ).toEqual([]);
  });
});

describe("isIgnored", () => {
  it("matches exact files and directory prefixes", () => {
    const ignore = ["package-lock.json", "docs/"];

    expect(isIgnored("package-lock.json", ignore)).toBe(true);
    expect(isIgnored("docs/research.md", ignore)).toBe(true);
    expect(isIgnored("src/docs/a.md", ignore)).toBe(false);
    expect(isIgnored("package.json", ignore)).toBe(false);
  });
});

describe("preflightOptions", () => {
  const config = {
    site: { name: "A", domain: "a.test" },
    preflight: {
      apiEndpoints: ["/api/contact"],
      previewOrigin: "https://preview.a.test",
    },
  };
  const site = /** @type {import("../config/index.mjs").Site} */ (
    resolveSite(config)
  );

  it("checks production by default, with the config's inputs", () => {
    expect(preflightOptions(config, site, [])).toEqual({
      productionHost: "a.test",
      origin: undefined,
      apiEndpoints: ["/api/contact"],
    });
  });

  it("checks a passed origin, or the preview with --preview", () => {
    expect(preflightOptions(config, site, ["https://x.test"]).origin).toBe(
      "https://x.test",
    );
    expect(preflightOptions(config, site, ["--preview"]).origin).toBe(
      "https://preview.a.test",
    );
    expect(() =>
      preflightOptions({ site: config.site }, site, ["--preview"]),
    ).toThrow(/previewOrigin/);
  });

  it("verifies analytics only when the config has the section", () => {
    expect(preflightOptions(config, site, [])).not.toHaveProperty(
      "analyticsMeasurementId",
    );
    expect(
      preflightOptions({ ...config, analytics: {} }, site, [])
        .analyticsMeasurementId,
    ).toBe("");
    expect(
      preflightOptions(
        { ...config, analytics: { measurementId: "G-1" } },
        site,
        [],
      ).analyticsMeasurementId,
    ).toBe("G-1");
  });
});

describe("defaultRoutes", () => {
  it("shoots the home page of every locale", () => {
    expect(defaultRoutes(["en"])).toEqual([{ name: "home", path: "/" }]);
    expect(defaultRoutes(["en", "es"])).toEqual([
      { name: "en", path: "/" },
      { name: "es", path: "/es" },
    ]);
  });
});
