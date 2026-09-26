import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  normalizeOptionalGithubUrl,
  parseGitHubUrl,
} from "./lib/repo";

async function requireUserId(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("UNAUTHENTICATED");
  return userId;
}

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const name = args.name.trim();
    if (name.length < 1 || name.length > 120) {
      throw new Error("INVALID_NAME");
    }
    const description = args.description?.trim() || undefined;
    if (description && description.length > 600) {
      throw new Error("DESCRIPTION_TOO_LONG");
    }

    let source: "github" | "demo" = "demo";
    let githubUrl: string | undefined;
    let githubOwner: string | undefined;
    let githubRepo: string | undefined;

    if (args.githubUrl) {
      const parsed = parseGitHubUrl(args.githubUrl);
      if (!parsed) throw new Error("INVALID_GITHUB_URL");
      githubUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;
      githubOwner = parsed.owner;
      githubRepo = parsed.repo;
      source = "github";
    } else {
      const normalized = normalizeOptionalGithubUrl(args.githubUrl);
      if (normalized) {
        githubUrl = normalized;
        source = "github";
      }
    }

    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      userId,
      name,
      description,
      githubUrl,
      githubOwner,
      githubRepo,
      source,
      analysisCount: 0,
      archived: false,
    });
    return { projectId };
  },
});

export const list = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("archived"), false))
      .collect();
    return projects;
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) return null;
    return project;
  },
});

/** Internal: ownership-scoped fetch used by the analysis action. */
export const getInternal = internalMutation({
  args: { projectId: v.id("projects"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== args.userId) return null;
    return project;
  },
});

/** Internal: bump analysis bookkeeping on the project after a run. */
export const touchAnalysis = internalMutation({
  args: { projectId: v.id("projects"), score: v.number() },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return;
    await ctx.db.patch(args.projectId, {
      lastScore: args.score,
      analysisCount: project.analysisCount + 1,
      lastAnalyzedAt: Date.now(),
    });
  },
});
