/**
 * Bring-your-own-key AI provider catalog.
 * Key validation is intentionally limited to sanity checks (length, spacing,
 * known prefix). Providers change key formats, so strict patterns would
 * wrongly reject valid keys; real validation happens on the first API call.
 */

export type AIProvider = "gemini" | "openai" | "claude" | "openrouter";

export interface AIProviderInfo {
  label: string;
  defaultModel: string;
  keyHint: string;
  docsUrl: string;
}

const geminiInfo: AIProviderInfo = {
  label: "Google Gemini",
  defaultModel: "gemini-2.0-flash",
  keyHint: "Starts with AIza…",
  docsUrl: "https://aistudio.google.com/apikey",
};

const openaiInfo: AIProviderInfo = {
  label: "OpenAI (ChatGPT)",
  defaultModel: "gpt-4o-mini",
  keyHint: "Starts with sk-…",
  docsUrl: "https://platform.openai.com/api-keys",
};

const claudeInfo: AIProviderInfo = {
  label: "Anthropic Claude",
  defaultModel: "claude-3-5-sonnet-latest",
  keyHint: "Starts with sk-ant-…",
  docsUrl: "https://console.anthropic.com/settings/keys",
};

const openrouterInfo: AIProviderInfo = {
  label: "OpenRouter (100+ models)",
  defaultModel: "openai/gpt-4o-mini",
  keyHint: "Starts with sk-or-…",
  docsUrl: "https://openrouter.ai/keys",
};

export const AI_PROVIDER_INFO: Record<AIProvider, AIProviderInfo> = {
  gemini: geminiInfo,
  openai: openaiInfo,
  claude: claudeInfo,
  openrouter: openrouterInfo,
};

export const AI_PROVIDER_IDS: AIProvider[] = [
  "gemini",
  "openai",
  "claude",
  "openrouter",
];

export function isAIProvider(value: string): value is AIProvider {
  return (AI_PROVIDER_IDS as string[]).includes(value);
}

/** Display-safe preview such as "AIza…3f9a". Safe to store and show. */
export function maskKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return "••••";
  }
  return trimmed.slice(0, 4) + "…" + trimmed.slice(-4);
}

/**
 * Returns a human-readable error message, or null when the key passes the
 * sanity checks for its provider.
 */
export function validateKeyShape(
  provider: AIProvider,
  key: string,
): string | null {
  const trimmed = key.trim();
  if (trimmed.length < 20) {
    return "That key looks too short to be valid.";
  }
  if (trimmed.length > 400) {
    return "That key is too long to be valid.";
  }
  if (/\s/.test(trimmed)) {
    return "API keys cannot contain spaces or line breaks.";
  }
  const prefixChecks: Partial<Record<AIProvider, { prefix: string; message: string }>> = {
    gemini: {
      prefix: "AIza",
      message: "Gemini keys normally start with \"AIza\".",
    },
    openai: {
      prefix: "sk-",
      message: "OpenAI keys normally start with \"sk-\".",
    },
    claude: {
      prefix: "sk-ant-",
      message: "Claude keys normally start with \"sk-ant-\".",
    },
    openrouter: {
      prefix: "sk-or-",
      message: "OpenRouter keys normally start with \"sk-or-\".",
    },
  };
  const check = prefixChecks[provider];
  if (check && !trimmed.startsWith(check.prefix)) {
    return check.message + " Double-check the key.";
  }
  return null;
}

// ── Direct provider calls (server-side only) ───────────────────────────────

/**
 * Calls the chosen provider with the given key and prompt.
 * Returns the model's text, or undefined on any failure so the caller can
 * fall back to the next AI tier. Errors are swallowed deliberately: a bad
 * user key must degrade the run, never crash it.
 */
export async function callProvider(
  provider: AIProvider,
  key: string,
  model: string | undefined,
  prompt: string,
): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model ?? "gemini-2.0-flash"}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
          }),
          signal: controller.signal,
        },
      );
      if (!res.ok) return undefined;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p?.text)
        .filter(Boolean)
        .join("");
      return typeof text === "string" && text.trim() ? text : undefined;
    }

    if (provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model ?? "claude-3-5-sonnet-latest",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });
      if (!res.ok) return undefined;
      const data = await res.json();
      const text = data?.content?.map((b: { text?: string }) => b?.text).filter(Boolean).join("");
      return typeof text === "string" && text.trim() ? text : undefined;
    }

    // OpenAI-compatible: openai and openrouter share the chat-completions shape.
    const baseUrl =
      provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : "https://api.openai.com/v1";
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model ?? "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a senior software architect and code reviewer. Respond with only valid JSON matching the requested schema — no markdown fences, no commentary.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
