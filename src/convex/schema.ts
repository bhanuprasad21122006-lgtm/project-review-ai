import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // A submitted project. Always owned by exactly one user.
    projects: defineTable({
      userId: v.id("users"),
      name: v.string(),
      description: v.optional(v.string()),
      githubUrl: v.optional(v.string()), // normalized https URL when source === "github"
      githubOwner: v.optional(v.string()),
      githubRepo: v.optional(v.string()),
      source: v.union(v.literal("github"), v.literal("demo")),
      lastScore: v.optional(v.number()),
      analysisCount: v.number(),
      lastAnalyzedAt: v.optional(v.number()),
      archived: v.boolean(),
    })
      .index("by_user", ["userId"])
      .index("by_user_and_repo", ["userId", "githubOwner", "githubRepo"]),

    // User-supplied AI API keys (bring-your-own-key). The key material is
    // write-only from the client's perspective: save/remove/status only,
    // never returned to any client query.
    aiKeys: defineTable({
      userId: v.id("users"),
      provider: v.union(
        v.literal("gemini"),
        v.literal("openai"),
        v.literal("claude"),
        v.literal("openrouter"),
      ),
      keyEncrypted: v.string(), // key material; never exposed via public queries
      keyPreview: v.string(), // e.g. "AIza…3f9a" for UI status display
      model: v.optional(v.string()),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // One AI analysis run per project. Stored context + findings.
    analyses: defineTable({
      // Which AI tier produced the stored result:
      // "gemini" | "openai" | "claude" | "openrouter" | "gateway" | "heuristic"
      aiEngine: v.optional(v.string()),
      userId: v.id("users"),
      projectId: v.id("projects"),
      status: v.union(
        v.literal("scanning"),
        v.literal("analyzing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
      isDemo: v.boolean(),
      stage: v.string(),
      error: v.optional(v.string()),
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
      result: v.optional(
        v.object({
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
      ),
    })
      .index("by_project", ["projectId"])
      .index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
