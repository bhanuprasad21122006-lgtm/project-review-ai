import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ROLES } from "./schema";

/**
 * Admin area backend.
 *
 * Bootstrap rule (internal tooling): while the workspace has no admin, the
 * first signed-in user may claim the role. Afterwards, only existing admins
 * can change roles. Every admin function re-verifies the caller's role.
 */

async function getViewer(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return { userId, user };
}

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const viewer = await getViewer(ctx);
  if (!viewer) throw new Error("UNAUTHENTICATED");
  if (viewer.user.role !== ROLES.ADMIN) throw new Error("FORBIDDEN");
  return viewer;
}

/** Role + email of the signed-in user (drives the header admin link). */
export const me = query({
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (!viewer) return null;
    return {
      userId: viewer.userId,
      email: viewer.user.email ?? null,
      name: viewer.user.name ?? null,
      role: viewer.user.role ?? null,
    };
  },
});

/** True when the workspace has no admin yet (enables the bootstrap claim). */
export const adminSlotOpen = query({
  handler: async (ctx) => {
    const admins = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), ROLES.ADMIN))
      .take(2);
    return admins.length === 0;
  },
});

/** First signed-in user claims admin while no admin exists. */
export const claimAdmin = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const admins = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), ROLES.ADMIN))
      .take(1);
    if (admins.length > 0) throw new Error("ADMIN_EXISTS");
    await ctx.db.patch(userId, { role: ROLES.ADMIN });
    return { ok: true };
  },
});

/** Admin overview: workspace totals. */
export const overview = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [users, projects, analyses] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("projects").collect(),
      ctx.db.query("analyses").collect(),
    ]);
    const scored = projects.filter((p) => typeof p.lastScore === "number");
    const avgScore =
      scored.length > 0
        ? Math.round(
            scored.reduce((sum, p) => sum + (p.lastScore ?? 0), 0) /
              scored.length,
          )
        : null;
    return {
      totalUsers: users.length,
      totalProjects: projects.length,
      totalAnalyses: analyses.length,
      completedAnalyses: analyses.filter((a) => a.status === "complete").length,
      avgScore,
    };
  },
});

/** All users with their project counts. Admin only. */
export const listUsers = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").collect();
    const projects = await ctx.db.query("projects").collect();
    return users.map((user) => ({
      userId: user._id,
      email: user.email ?? null,
      name: user.name ?? null,
      role: user.role ?? null,
      isAnonymous: user.isAnonymous ?? false,
      createdAt: user._creationTime,
      projectCount: projects.filter((p) => p.userId === user._id).length,
    }));
  },
});

/** All projects with owner email. Admin only. */
export const listAllProjects = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [projects, users] = await Promise.all([
      ctx.db.query("projects").order("desc").collect(),
      ctx.db.query("users").collect(),
    ]);
    const emailById = new Map(users.map((u) => [u._id, u.email ?? null]));
    return projects.map((project) => ({
      projectId: project._id,
      name: project.name,
      source: project.source,
      ownerEmail: emailById.get(project.userId) ?? null,
      lastScore: project.lastScore ?? null,
      analysisCount: project.analysisCount,
      createdAt: project._creationTime,
    }));
  },
});

/** Change a user's role. Admin only. */
export const setRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("user"), v.literal("member")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("USER_NOT_FOUND");
    await ctx.db.patch(args.userId, { role: args.role });
    return { ok: true };
  },
});
