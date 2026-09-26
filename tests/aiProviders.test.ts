import { describe, expect, test } from "bun:test";
import {
  AI_PROVIDER_IDS,
  AI_PROVIDER_INFO,
  isAIProvider,
  maskKey,
  validateKeyShape,
} from "../src/convex/lib/aiProviders";

describe("provider catalog", () => {
  test("exposes all four providers with complete metadata", () => {
    expect(AI_PROVIDER_IDS).toEqual([
      "gemini",
      "openai",
      "claude",
      "openrouter",
    ]);
    for (const id of AI_PROVIDER_IDS) {
      const info = AI_PROVIDER_INFO[id];
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.defaultModel.length).toBeGreaterThan(0);
      expect(info.keyHint.length).toBeGreaterThan(0);
      expect(info.docsUrl.startsWith("https://")).toBe(true);
    }
  });

  test("isAIProvider narrows known ids and rejects unknown ones", () => {
    expect(isAIProvider("gemini")).toBe(true);
    expect(isAIProvider("openrouter")).toBe(true);
    expect(isAIProvider("chatgpt")).toBe(false);
    expect(isAIProvider("")).toBe(false);
  });
});

describe("maskKey", () => {
  test("shows first and last four characters only", () => {
    expect(maskKey("AIzaSyabcdefghijklmnopqrstuvw3f9a")).toBe(
      "AIza…3f9a",
    );
  });

  test("hides short keys completely", () => {
    expect(maskKey("short")).toBe("••••");
    expect(maskKey("12345678")).toBe("••••");
  });

  test("never returns the full key", () => {
    const key = "sk-ant-api03-verylongsecretvalue1234567890";
    const masked = maskKey(key);
    expect(masked).not.toBe(key);
    expect(masked.length).toBeLessThan(key.length);
  });
});

describe("validateKeyShape", () => {
  test("accepts keys with the right prefix and length", () => {
    expect(validateKeyShape("gemini", "AIzaSyA1234567890abcdefghijklmnop")).toBeNull();
    expect(validateKeyShape("openai", "sk-proj1234567890abcdefghijklmnop")).toBeNull();
    expect(
      validateKeyShape("claude", "sk-ant-api03-1234567890abcdefghijklmn"),
    ).toBeNull();
    expect(
      validateKeyShape("openrouter", "sk-or-v1-1234567890abcdefghijklmn"),
    ).toBeNull();
  });

  test("rejects keys that are too short", () => {
    expect(validateKeyShape("gemini", "AIza123")).toBe(
      "That key looks too short to be valid.",
    );
  });

  test("rejects keys that are too long", () => {
    const long = "AIza" + "a".repeat(401);
    expect(validateKeyShape("gemini", long)).toBe(
      "That key is too long to be valid.",
    );
  });

  test("rejects keys containing internal whitespace", () => {
    expect(validateKeyShape("openai", "sk-1234567890 abcdefghijklmnop")).toBe(
      "API keys cannot contain spaces or line breaks.",
    );
  });

  test("tolerates leading or trailing whitespace (trimmed)", () => {
    expect(validateKeyShape("openai", "  sk-1234567890abcdefghijklmn")).toBeNull();
    expect(validateKeyShape("openai", "sk-1234567890abcdefghijklmn\n")).toBeNull();
  });

  test("warns when the prefix does not match the provider", () => {
    expect(validateKeyShape("gemini", "sk-1234567890abcdefghijklmn")).toContain(
      "AIza",
    );
    expect(validateKeyShape("claude", "sk-1234567890abcdefghijklmn")).toContain(
      "sk-ant-",
    );
    expect(
      validateKeyShape("openrouter", "sk-1234567890abcdefghijklmn"),
    ).toContain("sk-or-");
  });
});
