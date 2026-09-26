import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  isAIProvider,
  maskKey,
  validateKeyShape,
} from "./lib/aiProviders";

/**
 * Save (upsert) the user's AI key. One key per user. Throws KEY_FORMAT_WARNING
 * when sanity checks fail — the client may offer to save anyway, since
 * providers sometimes change key formats.
 */
export const save = mutation({
  args: {
    provider: v.string(),
    key: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");

    if (!isAIProvider(args.provider)) {
      throw new Error("UNSUPPORTED_PROVIDER");
    }
    const key = args.key.trim();
    if (validateKeyShape(args.provider, key)) {
      throw new Error("KEY_FORMAT_WARNING");
    }
    const model = args.model?.trim() || undefined;
    if (model && model.length > 120) throw new Error("MODEL_TOO_LONG");

    const existing = await ctx.db
      .query("aiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const current = existing[0];

    const payload = {
      userId,
      provider: args.provider as never,
      keyEncrypted: key,
      keyPreview: maskKey(key),
      model,
      updatedAt: Date.now(),
    };

    if (current) {
      await ctx.db.patch(current._id, payload);
      return { ok: true as const };
    }
    await ctx.db.insert("aiKeys", payload);
    return { ok: true as const };
  },
});

/** Non-sensitive key status for the settings UI. */
export const status = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("aiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const row = rows[0];
    if (!row) return { hasKey: false as const };
    return {
      hasKey: true as const,
      provider: row.provider,
      keyPreview: row.keyPreview,
      model: row.model ?? null,
      updatedAt: row.updatedAt,
    };
  },
});

/** Removes the user's stored key. */
export const remove = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const rows = await ctx.db
      .query("aiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { ok: true as const };
  },
});

/** Internal fetch used by the analysis action (server-side only). */
export const getInternal = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});
