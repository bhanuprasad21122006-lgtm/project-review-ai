import { describe, expect, test } from "bun:test";
import {
  MAX_FILES,
  normalizeOptionalGithubUrl,
  packProjectContext,
  parseGitHubUrl,
  rankFiles,
  shouldIncludeFile,
} from "../src/convex/lib/repo";

describe("parseGitHubUrl", () => {
  test("accepts a plain https repo URL", () => {
    expect(parseGitHubUrl("https://github.com/octocat/Hello-World")).toEqual({
      owner: "octocat",
      repo: "hello-world",
    });
  });

  test("accepts trailing slash, deep paths, and .git suffix", () => {
    expect(parseGitHubUrl("https://github.com/owner/repo/")).toEqual({
      owner: "owner",
      repo: "repo",
    });
    expect(
      parseGitHubUrl("https://github.com/owner/repo/tree/main/src"),
    ).toEqual({ owner: "owner", repo: "repo" });
    expect(parseGitHubUrl("https://github.com/owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  test("rejects non-https protocols", () => {
    expect(parseGitHubUrl("http://github.com/owner/repo")).toBeNull();
    expect(parseGitHubUrl("ftp://github.com/owner/repo")).toBeNull();
    expect(parseGitHubUrl("file:///etc/passwd")).toBeNull();
  });

  test("rejects non-github hosts", () => {
    expect(parseGitHubUrl("https://gitlab.com/owner/repo")).toBeNull();
    expect(parseGitHubUrl("https://github.example.com/owner/repo")).toBeNull();
    expect(parseGitHubUrl("https://example.com/owner/repo")).toBeNull();
  });

  test("rejects paths without owner and repo", () => {
    expect(parseGitHubUrl("https://github.com/owner")).toBeNull();
    expect(parseGitHubUrl("https://github.com/")).toBeNull();
    expect(parseGitHubUrl("https://github.com")).toBeNull();
  });

  test("rejects org and topic pages", () => {
    expect(
      parseGitHubUrl("https://github.com/orgs/acme/repositories"),
    ).toBeNull();
    expect(parseGitHubUrl("https://github.com/topics/react")).toBeNull();
  });

  test("rejects invalid characters in owner or repo", () => {
    expect(parseGitHubUrl("https://github.com/ow ner/repo")).toBeNull();
    expect(parseGitHubUrl("https://github.com/owner/re po")).toBeNull();
  });

  test("rejects garbage input", () => {
    expect(parseGitHubUrl("not a url")).toBeNull();
    expect(parseGitHubUrl("")).toBeNull();
  });
});

describe("normalizeOptionalGithubUrl", () => {
  test("returns undefined for empty or missing input", () => {
    expect(normalizeOptionalGithubUrl(undefined)).toBeUndefined();
    expect(normalizeOptionalGithubUrl("")).toBeUndefined();
    expect(normalizeOptionalGithubUrl("   ")).toBeUndefined();
  });

  test("returns undefined for invalid URLs instead of throwing", () => {
    expect(
      normalizeOptionalGithubUrl("https://evil.com/owner/repo"),
    ).toBeUndefined();
  });

  test("normalizes a valid URL", () => {
    expect(
      normalizeOptionalGithubUrl("https://github.com/Owner/Repo.git"),
    ).toBe("https://github.com/owner/repo");
  });
});

describe("shouldIncludeFile", () => {
  test("includes useful source and config files", () => {
    expect(shouldIncludeFile("README.md")).toBe(true);
    expect(shouldIncludeFile("package.json")).toBe(true);
    expect(shouldIncludeFile("src/index.ts")).toBe(true);
    expect(shouldIncludeFile("server/routes/api.ts")).toBe(true);
    expect(shouldIncludeFile(".env.example")).toBe(true);
    expect(shouldIncludeFile("src/styles/app.css")).toBe(true);
  });

  test("excludes ignored directories", () => {
    expect(shouldIncludeFile("node_modules/pkg/index.js")).toBe(false);
    expect(shouldIncludeFile(".git/config")).toBe(false);
    expect(shouldIncludeFile("dist/bundle.js")).toBe(false);
    expect(shouldIncludeFile("build/output.js")).toBe(false);
    expect(shouldIncludeFile("coverage/lcov-report/index.html")).toBe(false);
    expect(shouldIncludeFile(".next/server/app.js")).toBe(false);
  });

  test("excludes real env files but allows .env.example", () => {
    expect(shouldIncludeFile(".env")).toBe(false);
    expect(shouldIncludeFile("server/.env.local")).toBe(false);
    expect(shouldIncludeFile(".env.example")).toBe(true);
  });

  test("excludes binaries and large media", () => {
    expect(shouldIncludeFile("assets/logo.png")).toBe(false);
    expect(shouldIncludeFile("video/demo.mp4")).toBe(false);
    expect(shouldIncludeFile("archive.zip")).toBe(false);
    expect(shouldIncludeFile("fonts/inter.woff2")).toBe(false);
  });

  test("excludes overly long paths", () => {
    const longPath = "a/".repeat(200) + "file.ts";
    expect(shouldIncludeFile(longPath)).toBe(false);
  });
});

describe("rankFiles", () => {
  test("prioritizes README and dependency files over components", () => {
    const ranked = rankFiles([
      "src/components/Button.tsx",
      "package.json",
      "README.md",
      "src/utils/helpers.ts",
    ]);
    expect(ranked.indexOf("README.md")).toBeLessThan(
      ranked.indexOf("src/components/Button.tsx"),
    );
    expect(ranked.indexOf("package.json")).toBeLessThan(
      ranked.indexOf("src/utils/helpers.ts"),
    );
  });

  test("drops files that fail the include filter", () => {
    const ranked = rankFiles([
      "src/index.ts",
      "node_modules/pkg/index.js",
      "assets/logo.png",
    ]);
    expect(ranked).toEqual(["src/index.ts"]);
  });

  test("caps the number of files at MAX_FILES", () => {
    const many = Array.from({ length: 120 }, (_, i) => `src/file${i}.ts`);
    expect(rankFiles(many)).toHaveLength(MAX_FILES);
  });
});

describe("packProjectContext", () => {
  test("includes metadata, file list, and selected file contents", () => {
    const context = packProjectContext(
      {
        fullName: "owner/repo",
        description: "A test repository",
        language: "TypeScript",
        stars: 12,
        defaultBranch: "main",
      },
      [
        {
          path: "src/index.ts",
          content: "console.log('hi');",
          truncated: false,
        },
      ],
      ["README.md", "src/index.ts"],
    );

    expect(context).toContain("name: owner/repo");
    expect(context).toContain("description: A test repository");
    expect(context).toContain("primary language: TypeScript");
    expect(context).toContain("default branch: main");
    expect(context).toContain("README.md");
    expect(context).toContain("─── src/index.ts ───");
    expect(context).toContain("console.log('hi');");
  });

  test("marks truncated files", () => {
    const context = packProjectContext(
      {
        fullName: "owner/repo",
        stars: 0,
        defaultBranch: "main",
      },
      [{ path: "big/file.ts", content: "...", truncated: true }],
      [],
    );
    expect(context).toContain("─── big/file.ts (truncated) ───");
  });
});
