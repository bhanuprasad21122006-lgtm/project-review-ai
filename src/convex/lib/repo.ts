/**
 * GitHub URL parsing, repository file selection, and project-context packing.
 * Security rules:
 *  - Only https github.com URLs are accepted (no gists, no other hosts).
 *  - Repository contents are READ ONLY. Nothing is ever executed.
 *  - File fetching is capped by count, size, and total budget.
 */

// ── URL parsing ────────────────────────────────────────────────────────────

/** Strictly parse a github.com repo URL. Returns null for anything else. */
export function parseGitHubUrl(raw: string): { owner: string; repo: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const owner = segments[0].toLowerCase();
  const repo = segments[1].replace(/\.git$/, "").toLowerCase();
  if (!/^[\w.-]{1,100}$/.test(owner) || !/^[\w.-]{1,100}$/.test(repo)) return null;
  if (owner === "orgs" || repo === "topics") return null;
  return { owner, repo };
}

/** Accepts optional github.com repo URL; used for demo source validation. */
export function normalizeOptionalGithubUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const parsed = parseGitHubUrl(trimmed);
  if (!parsed) return undefined;
  return `https://github.com/${parsed.owner}/${parsed.repo}`;
}

// ── File selection rules ───────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set([
  ".md", ".mdx", ".txt", ".json", ".yml", ".yaml", ".toml",
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift",
  ".php", ".cs", ".c", ".h", ".cpp", ".hpp", ".csproj", ".sln",
  ".html", ".css", ".scss", ".vue", ".svelte",
  ".sql", ".prisma", ".graphql", ".gql", ".env.example", ".lock",
]);

const IGNORED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", "coverage",
  ".cache", ".next", ".nuxt", ".venv", "venv", "env",
  "__pycache__", ".idea", ".vscode", "vendor", "target", "bin", "obj",
  ".gradle", "public/assets", "assets/vendor", "storybook-static",
]);

/**
 * Cap on files fetched from GitHub per scan. GitHub allows 60 unauthenticated
 * requests/hour; 50 files + metadata + tree stays under that budget.
 */
export const MAX_FILES = 50;
/** Cap on bytes per file. */
export const MAX_FILE_BYTES = 48_000;
/** Cap on total context bytes sent to the model. */
export const MAX_TOTAL_BYTES = 320_000;
/** Cap on files listed in the tree (names only, cheap). */
export const MAX_TREE_FILES = 1200;

const PRIORITY_PATTERNS: { pattern: RegExp; priority: number }[] = [
  { pattern: /(^|\/)readme\.(md|txt)$/i, priority: 0 },
  { pattern: /(^|\/)(package|requirements|pyproject|cargo|go\.mod|pom|composer)\.(json|txt|toml|xml|mod|lock)$/i, priority: 1 },
  { pattern: /(^|\/)(index|main|app|server|wsgi|manage)\.[a-z]+$/i, priority: 2 },
  { pattern: /(^|\/)(routes?|controllers?|routers?)\/[^/]+$/i, priority: 3 },
  { pattern: /(^|\/)(services?|api)\/[^/]+$/i, priority: 4 },
  { pattern: /(^|\/)(components?|pages|views|screens)\/[^/]+$/i, priority: 5 },
  { pattern: /(^|\/)(models?|schema|schemas|entities|prisma|migrations)\/[^/]+$/i, priority: 6 },
  { pattern: /(^|\/)(tests?|__tests__|e2e|spec)\/[^/]+$/i, priority: 7 },
  { pattern: /(^|\/)\.env\.example$/i, priority: 8 },
  { pattern: /(^|\/)(dockerfile|docker-compose|vite|tailwind|tsconfig|next|webpack)\.[a-z.]*$/i, priority: 9 },
];

function priorityOf(path: string): number {
  for (const { pattern, priority } of PRIORITY_PATTERNS) {
    if (pattern.test(path)) return priority;
  }
  return 20;
}

export function shouldIncludeFile(path: string): boolean {
  if (path.length > 260) return false;
  const lower = path.toLowerCase();
  if (lower.endsWith("/")) return false;
  const segments = lower.split("/");
  if (segments.some((s) => IGNORED_DIRS.has(s))) return false;
  if (/(^|\/)\.env($|\.)/.test(lower) && !lower.endsWith(".env.example")) return false;
  const ext = lower.slice(lower.lastIndexOf("."));
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  if (/\.(png|jpe?g|gif|webp|svg|ico|mp4|mov|zip|gz|pdf|woff2?|ttf)$/.test(lower)) return false;
  return true;
}

/** Rank files: priority first, then shallow paths, then alphabetical. */
export function rankFiles(paths: string[]): string[] {
  return [...paths]
    .filter(shouldIncludeFile)
    .sort((a, b) => {
      const pa = priorityOf(a);
      const pb = priorityOf(b);
      if (pa !== pb) return pa - pb;
      const da = a.split("/").length;
      const db = b.split("/").length;
      if (da !== db) return da - db;
      return a.localeCompare(b);
    })
    .slice(0, MAX_FILES);
}

// ── Project context packing ────────────────────────────────────────────────

export interface ContextFile {
  path: string;
  content: string;
  truncated: boolean;
}

/** Render the compact project context that the model will reason over. */
export function packProjectContext(
  meta: {
    fullName: string;
    description?: string;
    language?: string;
    stars: number;
    defaultBranch: string;
  },
  files: ContextFile[],
  additionalFiles: string[],
): string {
  const parts: string[] = [];
  parts.push(`# REPOSITORY METADATA`);
  parts.push(`name: ${meta.fullName}`);
  parts.push(`description: ${meta.description ?? "(none)"}`);
  parts.push(`primary language: ${meta.language ?? "(unknown)"}`);
  parts.push(`stars: ${meta.stars}`);
  parts.push(`default branch: ${meta.defaultBranch}`);
  parts.push("");
  parts.push(`# FULL FILE LIST (${additionalFiles.length} tracked files, names only)`);
  for (const f of additionalFiles.slice(0, MAX_TREE_FILES)) parts.push(f);
  parts.push("");
  parts.push(`# SELECTED FILE CONTENTS (prioritized, size-capped, possibly truncated)`);
  for (const f of files) {
    parts.push(`─── ${f.path}${f.truncated ? " (truncated)" : ""} ───`);
    parts.push(f.content);
  }
  return parts.join("\n");
}
