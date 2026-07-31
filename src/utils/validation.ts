/**
 * Generic validation utilities. Each factory takes its error message so the
 * copy stays in the content layer (src/content) and can be localized.
 */

import type { Validation } from "../domain/form";

export const requiredValidation = (message: string): Validation => {
  return (value: string) => {
    const length = value.trim().length;

    if (length < 1) {
      return message;
    }
  };
};

export const emailValidation = (message: string): Validation => {
  return (value: string) => {
    const trimmedValue = value.trim();
    const validRegex = /^[\w.+-]+@([\w-]+\.)+[\w-]{2,63}$/;

    if (!validRegex.test(trimmedValue)) {
      return message;
    }
  };
};

/**
 * Requires at least `min` whitespace-separated words. Filters the gibberish
 * bot submissions that paste one random token into every field.
 */
export const wordsValidation = (min: number, message: string): Validation => {
  return (value: string) => {
    const words = value.trim().split(/\s+/).filter(Boolean);

    if (words.length < min) {
      return message;
    }
  };
};

export const lengthValidation = (options: {
  min?: number;
  max?: number;
  minMessage?: string;
  maxMessage?: string;
}): Validation => {
  return (value: string) => {
    const length = value.trim().length;
    const minLength = options.min;
    const maxLength = options.max;

    if (minLength && length < minLength) {
      return options.minMessage;
    }

    if (maxLength && length > maxLength) {
      return options.maxMessage;
    }
  };
};
