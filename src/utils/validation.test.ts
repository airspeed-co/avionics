import {
  emailValidation,
  lengthValidation,
  requiredValidation,
  wordsValidation,
} from "./validation";
import { describe, expect, it } from "vitest";

const REQUIRED = "This field is required.";
const INVALID_EMAIL = "Invalid email address.";

describe("requiredValidation", () => {
  const validator = requiredValidation(REQUIRED);

  it("returns error for empty string", () => {
    expect(validator("")).toBe(REQUIRED);
  });

  it("returns error for whitespace only", () => {
    expect(validator("   ")).toBe(REQUIRED);
  });

  it("returns undefined for non-empty string", () => {
    expect(validator("test")).toBeUndefined();
  });
});

describe("emailValidation", () => {
  const validator = emailValidation(INVALID_EMAIL);

  it("returns error for invalid email", () => {
    expect(validator("invalid")).toBe(INVALID_EMAIL);
    expect(validator("test@")).toBe(INVALID_EMAIL);
    expect(validator("@example.com")).toBe(INVALID_EMAIL);
  });

  it("returns undefined for valid email", () => {
    expect(validator("test@example.com")).toBeUndefined();
    expect(validator("user.name+tag@domain.co.uk")).toBeUndefined();
  });

  it("trims whitespace before validation", () => {
    expect(validator("  test@example.com  ")).toBeUndefined();
    expect(validator("  invalid  ")).toBe(INVALID_EMAIL);
  });
});

describe("wordsValidation", () => {
  const MESSAGE = "Please write a complete message.";
  const validator = wordsValidation(3, MESSAGE);

  it("rejects a single gibberish token", () => {
    // cspell:disable-next-line
    expect(validator("jqkSATxqSErPVJawvdpMC")).toBe(MESSAGE);
  });

  it("rejects fewer words than the minimum", () => {
    expect(validator("two words")).toBe(MESSAGE);
  });

  it("accepts the minimum word count", () => {
    expect(validator("three whole words")).toBeUndefined();
  });

  it("ignores extra whitespace between words", () => {
    expect(validator("  three   whole   words  ")).toBeUndefined();
  });
});

describe("lengthValidation", () => {
  it("validates minimum length", () => {
    const validator = lengthValidation({
      min: 5,
      minMessage: "5 characters minimum.",
    });
    expect(validator("1234")).toBe("5 characters minimum.");
    expect(validator("12345")).toBeUndefined();
  });

  it("validates maximum length", () => {
    const validator = lengthValidation({
      max: 10,
      maxMessage: "10 characters maximum.",
    });
    expect(validator("12345678901")).toBe("10 characters maximum.");
    expect(validator("1234567890")).toBeUndefined();
  });

  it("validates both min and max", () => {
    const validator = lengthValidation({
      min: 3,
      max: 5,
      minMessage: "3 characters minimum.",
      maxMessage: "5 characters maximum.",
    });
    expect(validator("12")).toBe("3 characters minimum.");
    expect(validator("123456")).toBe("5 characters maximum.");
    expect(validator("123")).toBeUndefined();
    expect(validator("12345")).toBeUndefined();
  });

  it("trims whitespace before validation", () => {
    const validator = lengthValidation({
      min: 3,
      minMessage: "3 characters minimum.",
    });
    expect(validator("  a  ")).toBe("3 characters minimum.");
    expect(validator("  abc  ")).toBeUndefined();
  });
});
