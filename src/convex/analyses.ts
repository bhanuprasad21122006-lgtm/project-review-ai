"use node";

/**
 * Analysis engine:
 *   GitHub repo → read (capped, prioritized) → project context → AI → validated result.
 *
 * Security:
 *   - GitHub and AI calls happen server-side only; tokens/keys never reach the client.
 *   - Repo contents are read over HTTPS and treated as data. Nothing is ever executed.
 *   - Output is validated before storage; failures never leak internals to the client.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  packProjectContext,
  rankFiles,
} from "./lib/repo";
import {
  CATEGORIES,
  calculateScore,
  clampScore,
  clampSeverity,
} from "./lib/scoring";

const GEMINI_MODEL = "gemini-2.0-flash";
const DEMO_FILE_LIST = [
  "README.md",
  "package.json",
  "src/index.ts",
  "src/routes.ts",
  "src/db/schema.ts",
  "src/services/ai.ts",
  "src/components/App.tsx",
  "tests/api.test.ts",
  ".env.example",
];

// ── GitHub reading ──────────────────────────────────────────────────────────

async function ghFetch(
  url: string,
  token: string | undefined,
): Promise<{ ok: true; data: any } | { ok: false; status: number }> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ai-project-mentor",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function readRepoFiles(
  owner: string,
  repo: string,
  branch: string,
  token: string | undefined,
  filePaths: string[],
): Promise<{ path: string; content: string; truncated: boolean }[]> {
  const files: { path: string; content: string; truncated: boolean }[] = [];
  let totalBytes = 0;

  for (const path of filePaths) {
    if (files.length >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) break;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.raw",
      "User-Agent": "ai-project-mentor",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (res.ok) {
        const raw = await res.text();
        const truncated = raw.length > MAX_FILE_BYTES;
        const content = truncated ? raw.slice(0, MAX_FILE_BYTES) : raw;
        files.push({ path, content, truncated });
        totalBytes += content.length;
      }
      // missing/deleted/unfetchable files are skipped quietly
    } catch {
      // network error or timeout: skip this file
    } finally {
      clearTimeout(timer);
    }
  }

  return files;
}

// ── AI analysis ─────────────────────────────────────────────────────────────

function buildPrompt(context: string, projectName: string): string {
  const weightLines = CATEGORIES.map(
    (c) => `- ${c.key} (${c.name}) — weight ${c.weight}`,
  ).join("\n");
  return `You are a senior software architect, code reviewer, security reviewer, and academic project mentor.

You are analyzing a software project. Below is the FULL EVIDENCE available to you:
a file list and the contents of a prioritized subset of files from one GitHub repository.

STRICT RULES:
1. Base every claim ONLY on the supplied evidence. Never invent files, routes, tests, or features.
2. If something cannot be established from the evidence, write exactly "Not verifiable from the provided repository data." for that item.
3. Do not modify code, do not generate code for the submitter, do not execute anything.
4. Score each category 0-100 from the evidence. Justify each score in one or two sentences.

CATEGORY WEIGHTS (the final health score is computed from these):
${weightLines}

PROJECT NAME: ${projectName}

=== PROJECT CONTEXT START ===
${context}
=== PROJECT CONTEXT END ===

Respond with ONLY a JSON object matching this shape (no markdown fences, no commentary):
{
  "categories": [{ "key": "problem|architecture|code|security|database|testing|documentation|ux|innovation", "score": 0-100 integer, "comment": "1-2 sentence justification citing evidence" }],
  "summary": "2-3 sentence overall assessment",
  "verdict": "one short verdict line, max 90 chars",
  "strengths": [{ "title": "short title", "detail": "what is good and why, based on evidence", "evidence": ["file path or observation"] }],
  "weaknesses": [{ "title": "short title", "detail": "what needs improvement and why", "severity": "critical|high|medium|low", "evidence": ["file path or observation"] }],
  "nextSteps": ["3-6 concrete, prioritized improvement actions"]
}`;
}

function extractJson(text: string): any {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("AI_RESPONSE_MALFORMED");
  }
}

interface ValidatedAnalysis {
  categories: {
    key: string;
    name: string;
    score: number;
    weight: number;
    comment: string;
  }[];
  score: number;
  summary: string;
  verdict: string;
  strengths: { title: string; detail: string; evidence?: string[] }[];
  weaknesses: {
    title: string;
    detail: string;
    severity: string;
    evidence?: string[];
  }[];
  nextSteps: string[];
}

function validateAnalysis(parsed: any): ValidatedAnalysis {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI_RESPONSE_MALFORMED");
  }
  const validKeys = new Set(CATEGORIES.map((c) => c.key));
  const nameOf = (key: string) =>
    CATEGORIES.find((c) => c.key === key)?.name ?? key;
  const weightOf = (key: string) =>
    CATEGORIES.find((c) => c.key === key)?.weight ?? 0;

  const rawCategories = Array.isArray(parsed.categories) ? parsed.categories : [];
  const categories = rawCategories
    .filter((c: any) => c && validKeys.has(c.key))
    .map((c: any) => ({
      key: c.key as string,
      name: nameOf(c.key),
      score: clampScore(c.score),
      weight: weightOf(c.key),
      comment:
        typeof c.comment === "string" && c.comment.trim()
          ? c.comment.trim().slice(0, 600)
          : "No justification provided.",
    }));
  if (categories.length === 0) throw new Error("AI_RESPONSE_MALFORMED");

  const { score } = calculateScore(categories);

  const toEvidence = (value: any): string[] | undefined =>
    Array.isArray(value)
      ? value.slice(0, 4).map((e) => String(e).slice(0, 200))
      : undefined;

  const strengths = (Array.isArray(parsed.strengths) ? parsed.strengths : [])
    .slice(0, 6)
    .map((s: any) => ({
      title: String(s?.title ?? "").trim().slice(0, 120),
      detail: String(s?.detail ?? "").slice(0, 600),
      evidence: toEvidence(s?.evidence),
    }))
    .filter((s: { title: string }) => s.title.length > 0);

  const weaknesses = (Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [])
    .slice(0, 8)
    .map((w: any) => ({
      title: String(w?.title ?? "").trim().slice(0, 120),
      detail: String(w?.detail ?? "").slice(0, 600),
      severity: clampSeverity(w?.severity),
      evidence: toEvidence(w?.evidence),
    }))
    .filter((w: { title: string }) => w.title.length > 0);

  const nextSteps = (Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [])
    .slice(0, 6)
    .map((s: any) => String(s).slice(0, 300))
    .filter((s: string) => s.trim().length > 0);

  return {
    categories,
    score,
    summary: String(parsed.summary ?? "").trim().slice(0, 900) ||
      "No summary provided.",
    verdict: String(parsed.verdict ?? "").trim().slice(0, 120) ||
      "Assessment complete. Review the findings below.",
    strengths,
    weaknesses,
    nextSteps,
  };
}

// ── Demo fallback ───────────────────────────────────────────────────────────

function buildDemoAnalysis(project: { name: string; description?: string }) {
  const categories = [
    { key: "problem", name: "Problem Definition", score: 82, weight: 0.1, comment: "Demo data: the problem statement is clear and scoped." },
    { key: "architecture", name: "Architecture", score: 78, weight: 0.15, comment: "Demo data: layered structure with separated routes and services." },
    { key: "code", name: "Code Quality", score: 74, weight: 0.15, comment: "Demo data: consistent style, moderate module sizes." },
    { key: "security", name: "Security", score: 62, weight: 0.15, comment: "Demo data: no visible auth hardening or rate limiting." },
    { key: "database", name: "Database", score: 70, weight: 0.1, comment: "Demo data: schema present with basic indexes." },
    { key: "testing", name: "Testing", score: 45, weight: 0.1, comment: "Demo data: only a few happy-path tests exist." },
    { key: "documentation", name: "Documentation", score: 80, weight: 0.1, comment: "Demo data: README covers setup and API routes." },
    { key: "ux", name: "UX", score: 68, weight: 0.05, comment: "Demo data: responsive layout, missing empty/loading states." },
    { key: "innovation", name: "Innovation", score: 72, weight: 0.1, comment: "Demo data: reasonable use of AI in one module." },
  ];
  const score = calculateScore(categories).score;
  return {
    result: {
      score,
      summary: `Demo analysis for ${project.name}. This is prepared sample data shown to demonstrate the analysis flow without a live repository scan.`,
      verdict: "DEMO ANALYSIS — prepared sample data, not a live scan.",
      categories,
      strengths: [
        { title: "Clear problem statement", detail: "The demo project defines a scoped, testable problem.", evidence: ["README.md"] },
        { title: "Separated service layer", detail: "Business logic is isolated from route handlers.", evidence: ["src/services/ai.ts"] },
      ],
      weaknesses: [
        { title: "Thin test coverage", detail: "Only happy-path tests exist; edge cases are untested.", severity: "high", evidence: ["tests/api.test.ts"] },
        { title: "No rate limiting", detail: "Public endpoints lack throttling.", severity: "medium", evidence: ["src/routes.ts"] },
      ],
      nextSteps: [
        "Add integration tests for the authentication flow.",
        "Introduce rate limiting on public endpoints.",
        "Document the database schema in the README.",
      ],
    },
  };
}

// ── Deterministic heuristic (no AI key configured) ─────────────────────────

function buildHeuristicAnalysis(
  files: { path: string; content: string }[],
  allPaths: string[],
  projectName: string,
): ValidatedAnalysis {
  const paths = files.map((f) => f.path);
  const has = (re: RegExp) => paths.some((p) => re.test(p));
  const hasReadme = has(/readme\.(md|txt)$/i);
  const hasTests = has(/(tests?|__tests__|e2e|spec)\//i);
  const hasSchema = has(/(schema|prisma|migrations|models)\//i);
  const hasEnvExample = has(/\.env\.example$/i);
  const hasDocker = has(/dockerfile|docker-compose/i);
  const hasCi = allPaths.some((p) => /^\.github\/(workflows|ci)/i.test(p));
  const packageJson = files.find((f) => /package\.json$/i.test(f.path));
  let deps = 0;
  if (packageJson) {
    try {
      deps = Object.keys(JSON.parse(packageJson.content).dependencies ?? {}).length;
    } catch {
      deps = 0;
    }
  }

  const categories = CATEGORIES.map(({ key, name, weight }) => {
    let score = 40;
    let note = "limited signal from scanned files";
    if (key === "documentation") {
      score = hasReadme ? 70 : 25;
      note = hasReadme ? "README present" : "no README found";
    } else if (key === "testing") {
      score = hasTests ? 65 : 20;
      note = hasTests ? "test files found" : "no test files found";
    } else if (key === "database") {
      score = hasSchema ? 60 : 40;
      note = hasSchema ? "schema directory found" : "no schema detected";
    } else if (key === "security") {
      score = (hasEnvExample ? 60 : 35) + (hasDocker || hasCi ? 5 : 0);
      note = hasEnvExample ? ".env.example present" : "no .env.example found";
    } else if (key === "code") {
      score = Math.min(75, 40 + Math.floor(deps / 4));
      note = `${deps} runtime dependencies declared`;
    } else if (key === "architecture") {
      score = has(/^(src|app|server|api)\//i) ? 55 : 40;
      note = "structure reviewed from the file list";
    } else if (key === "ux" || key === "innovation" || key === "problem") {
      score = 50;
      note = "Not verifiable from the provided repository data.";
    }
    return {
      key,
      name,
      weight,
      score: clampScore(score),
      comment: `Heuristic check: ${note}.`,
    };
  });

  const strengths: ValidatedAnalysis["strengths"] = [];
  if (hasReadme) {
    strengths.push({
      title: "README present",
      detail: "A README was found, which helps reviewers understand the project.",
      evidence: [paths.find((p) => /readme/i.test(p)) ?? "README"],
    });
  }
  if (hasTests) {
    strengths.push({
      title: "Tests exist",
      detail: "Test files were detected in the repository.",
      evidence: [paths.find((p) => /(tests?|__tests__|e2e|spec)\//i.test(p)) ?? "tests/"],
    });
  }
  if (hasCi || hasDocker) {
    strengths.push({
      title: "Tooling configured",
      detail: "CI or container configuration files were detected.",
    });
  }

  const weaknesses: ValidatedAnalysis["weaknesses"] = [];
  if (!hasReadme) {
    weaknesses.push({
      title: "No README",
      detail: "The repository has no README, so project intent is undocumented.",
      severity: "high",
    });
  }
  if (!hasTests) {
    weaknesses.push({
      title: "No tests found",
      detail: "No test files were detected, so correctness is unverified.",
      severity: "high",
    });
  }
  if (!hasEnvExample) {
    weaknesses.push({
      title: "No .env.example",
      detail: "Configuration is undocumented; add a .env.example for setup.",
      severity: "medium",
    });
  }

  const nextSteps = [
    !hasReadme && "Add a README describing the problem, setup, and features.",
    !hasTests && "Add a minimal test suite covering the core flows.",
    !hasEnvExample && "Add a .env.example documenting required environment variables.",
    "Add GEMINI_API_KEY in the project keys to enable full AI analysis.",
  ].filter((s): s is string => Boolean(s));

  return {
    categories,
    score: calculateScore(categories).score,
    summary: `Heuristic review of ${projectName}: ${allPaths.length} tracked files were inspected for structure and configuration signals. This is a structural check, not a full AI analysis.`,
    verdict: "Heuristic scan complete — add GEMINI_API_KEY for full AI analysis.",
    strengths,
    weaknesses,
    nextSteps,
  };
}

// ── Public action ───────────────────────────────────────────────────────────

export const start = action({
  args: { projectId: v.id("projects") },
  handler: async (
    ctx,
    args,
  ): Promise<{ analysisId: string; isDemo: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");

    const project = await ctx.runMutation(internal.projects.getInternal, {
      projectId: args.projectId,
      userId,
    });
    if (!project) throw new Error("PROJECT_NOT_FOUND");

    // ── Demo flow: prepared data, clearly labeled ──
    if (project.source === "demo") {
      const demo = buildDemoAnalysis(project);
      const analysisId = await ctx.runMutation(
        internal.analysesStore.completeInternal,
        {
          projectId: args.projectId,
          userId,
          repoMeta: {
            fullName: "demo/team-showcase",
            description: project.description ?? "Demo project",
            defaultBranch: "main",
            language: "TypeScript",
            stars: 42,
            scannedFileCount: DEMO_FILE_LIST.length,
            scannedFileList: DEMO_FILE_LIST,
          },
          result: demo.result,
        },
      );
      await ctx.runMutation(internal.projects.touchAnalysis, {
        projectId: args.projectId,
        score: demo.result.score,
      });
      return { analysisId, isDemo: true };
    }

    // ── Real GitHub flow ──
    if (!project.githubOwner || !project.githubRepo) {
      throw new Error("INVALID_GITHUB_URL");
    }
    const token = process.env.GITHUB_TOKEN;

    const metaRes = await ghFetch(
      `https://api.github.com/repos/${project.githubOwner}/${project.githubRepo}`,
      token,
    );
    if (!metaRes.ok) {
      throw new Error(
        metaRes.status === 404
          ? "REPOSITORY_NOT_FOUND_OR_PRIVATE"
          : metaRes.status === 403
            ? "GITHUB_RATE_LIMIT"
            : "REPOSITORY_UNREACHABLE",
      );
    }
    const meta = metaRes.data as any;
    const branch = String(meta.default_branch || "main");

    const treeRes = await ghFetch(
      `https://api.github.com/repos/${project.githubOwner}/${project.githubRepo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      token,
    );
    if (!treeRes.ok) throw new Error("REPOSITORY_UNREACHABLE");
    const tree = (treeRes.data as any).tree as
      | { path: string; type: string }[]
      | undefined;
    if (!Array.isArray(tree)) throw new Error("REPOSITORY_UNREACHABLE");

    const allPaths = tree.filter((t) => t.type === "blob").map((t) => t.path);
    if (allPaths.length === 0) throw new Error("EMPTY_REPOSITORY");

    const analysisId = await ctx.runMutation(internal.analysesStore.beginInternal, {
      projectId: args.projectId,
      userId,
      stage: "scanning",
      repoMeta: {
        fullName: String(
          meta.full_name ?? `${project.githubOwner}/${project.githubRepo}`,
        ),
        description: meta.description ? String(meta.description) : undefined,
        defaultBranch: branch,
        language: meta.language ? String(meta.language) : undefined,
        stars: Number(meta.stargazers_count ?? 0),
        scannedFileCount: allPaths.length,
        scannedFileList: allPaths.slice(0, 300),
      },
    });

    // Stage 1: read repository files (capped, prioritized).
    const selected = rankFiles(allPaths);
    const files = await readRepoFiles(
      project.githubOwner,
      project.githubRepo,
      branch,
      token,
      selected,
    );

    await ctx.runMutation(internal.analysesStore.stageInternal, {
      analysisId,
      stage: "analyzing",
    });

    // Stage 2: analyze with AI (or deterministic heuristic if no key).
    const apiKey = process.env.GEMINI_API_KEY;
    let analysis: ValidatedAnalysis;
    if (apiKey) {
      const context = packProjectContext(
        {
          fullName: String(meta.full_name ?? ""),
          description: meta.description ? String(meta.description) : undefined,
          language: meta.language ? String(meta.language) : undefined,
          stars: Number(meta.stargazers_count ?? 0),
          defaultBranch: branch,
        },
        files,
        allPaths,
      );
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt(context, project.name) }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
          }),
        },
      );
      if (!res.ok) throw new Error("AI_REQUEST_FAILED");
      const data = await res.json();
      const text: string | undefined =
        data?.candidates?.[0]?.content?.parts
          ?.map((p: any) => p?.text)
          .filter(Boolean)
          .join("") ?? undefined;
      if (!text) throw new Error("AI_RESPONSE_MALFORMED");
      analysis = validateAnalysis(extractJson(text));
    } else {
      analysis = buildHeuristicAnalysis(files, allPaths, project.name);
    }

    await ctx.runMutation(internal.analysesStore.completeInternal, {
      projectId: args.projectId,
      userId,
      analysisId,
      result: {
        score: analysis.score,
        summary: analysis.summary,
        verdict: analysis.verdict,
        categories: analysis.categories,
        strengths: analysis.strengths.map((s) => ({
          title: s.title,
          detail: s.detail,
          evidence: s.evidence,
        })),
        weaknesses: analysis.weaknesses.map((w) => ({
          title: w.title,
          detail: w.detail,
          severity: w.severity,
          evidence: w.evidence,
        })),
        nextSteps: analysis.nextSteps,
      },
    });
    await ctx.runMutation(internal.projects.touchAnalysis, {
      projectId: args.projectId,
      score: analysis.score,
    });

    return { analysisId, isDemo: false };
  },
});

// ── Failure marking (called from the client-side error path) ───────────────

// Queries and mutations live in analysesStore.ts (Convex only permits actions
// inside "use node" modules).
