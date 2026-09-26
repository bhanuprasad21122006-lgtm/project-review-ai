import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, query } from "./_generated/server";

/**
 * Internal store helpers for the analysis action (which runs in Node.js).
 * Kept out of the "use node" module because Convex only allows actions there.
 */

export const beginInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    stage: v.string(),
    repoMeta: v.optional(
      v.object({
        fullName: v.string(),
        description: v.optional(v.string()),
        defaultBranch: v.string(),
        language: v.optional(v.string()),
        stars: v.number(),
        scannedFileCount: v.number(),
        scannedFileList: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Ownership was already verified in the action via projects.getInternal;
    // the userId passed here is the authenticated caller's id.
    return await ctx.db.insert("analyses", {
      userId: args.userId,
      projectId: args.projectId,
      status: "scanning",
      stage: args.stage,
      isDemo: false,
      repoMeta: args.repoMeta,
    });
  },
});

export const stageInternal = internalMutation({
  args: { analysisId: v.id("analyses"), stage: v.string() },
  handler: async (ctx, args) => {
    const status = args.stage === "analyzing" ? "analyzing" : "scanning";
    await ctx.db.patch(args.analysisId, { stage: args.stage, status });
  },
});

export const completeInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    analysisId: v.optional(v.id("analyses")),
    repoMeta: v.optional(
      v.object({
        fullName: v.string(),
        description: v.optional(v.string()),
        defaultBranch: v.string(),
        language: v.optional(v.string()),
        stars: v.number(),
        scannedFileCount: v.number(),
        scannedFileList: v.array(v.string()),
      }),
    ),
    result: v.object({
      score: v.number(),
      summary: v.string(),
      verdict: v.string(),
      categories: v.array(
        v.object({
          key: v.string(),
          name: v.string(),
          score: v.number(),
          weight: v.number(),
          comment: v.string(),
        }),
      ),
      strengths: v.array(
        v.object({
          title: v.string(),
          detail: v.string(),
          evidence: v.optional(v.array(v.string())),
        }),
      ),
      weaknesses: v.array(
        v.object({
          title: v.string(),
          detail: v.string(),
          severity: v.string(),
          evidence: v.optional(v.array(v.string())),
        }),
      ),
      nextSteps: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    let analysisId = args.analysisId;
    if (!analysisId) {
      analysisId = await ctx.db.insert("analyses", {
        userId: args.userId,
        projectId: args.projectId,
        status: "analyzing",
        stage: "analyzing",
        isDemo: true,
        repoMeta: args.repoMeta,
      });
    }
    await ctx.db.patch(analysisId, {
      status: "complete",
      stage: "complete",
      ...(args.repoMeta ? { repoMeta: args.repoMeta } : {}),
      result: args.result,
    });
    return analysisId;
  },
});

// ── Frontend queries/mutations ──────────────────────────────────────────────

/** Latest analysis for a project. Ownership enforced against the caller. */
export const getLatest = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) return null;
    const rows = await ctx.db
      .query("analyses")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(1);
    return rows[0] ?? null;
  },
});

/**
 * Marks this user's latest in-flight analysis for a project as failed.
 * Called by the client after the start action throws, so the UI stays truthful.
 */
export const markFailed = mutation({
  args: { projectId: v.id("projects"), error: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) return;
    const rows = await ctx.db
      .query("analyses")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(1);
    const latest = rows[0];
    if (!latest || latest.userId !== userId) return;
    if (latest.status === "complete") return;
    await ctx.db.patch(latest._id, {
      status: "failed",
      error: args.error.slice(0, 120),
    });
  },
});
