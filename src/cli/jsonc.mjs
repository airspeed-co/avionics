/*
 * A small JSONC reader for wrangler.jsonc: drops line and block comments and
 * trailing commas, then hands the rest to JSON.parse. Strings are copied
 * through untouched, so a "//" or a ",}" inside one survives.
 */

/**
 * @param {string} text
 * @returns {any}
 */
export function parseJsonc(text) {
  let json = "";
  let index = 0;
  // A comma is held back until the next token shows it is not trailing.
  let pendingComma = false;

  while (index < text.length) {
    const character = text[index];
    const next = text[index + 1];

    if (character === "/" && next === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
      continue;
    }

    if (character === "/" && next === "*") {
      const end = text.indexOf("*/", index + 2);

      index = end === -1 ? text.length : end + 2;
      continue;
    }

    if (/\s/.test(character)) {
      json += character;
      index += 1;
      continue;
    }

    if (character === ",") {
      pendingComma = true;
      index += 1;
      continue;
    }

    if (pendingComma) {
      if (character !== "}" && character !== "]") json += ",";

      pendingComma = false;
    }

    if (character === '"') {
      const start = index;

      index += 1;

      while (index < text.length && text[index] !== '"') {
        index += text[index] === "\\" ? 2 : 1;
      }

      index += 1;
      json += text.slice(start, index);
      continue;
    }

    json += character;
    index += 1;
  }

  return JSON.parse(json);
}
