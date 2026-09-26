# Project Mentor AI

**Understand. Analyze. Improve.**

Project Mentor AI reads a GitHub repository, scores it across nine weighted
engineering categories, and reports exactly what is strong, what is weak, and
what to fix first — with file-level evidence behind every claim.

It is **not** a code generator. It never modifies, executes, or builds the
repositories it reviews. Its only job is to read, understand, and evaluate.

---

## Overview

Project Mentor AI is an internal team tool for reviewing software projects.
A team member signs in, submits a public GitHub repository URL, and receives:

- a transparent **health score** (0–100) computed from nine weighted categories,
- **strengths** and **weaknesses** with severity ratings and file evidence,
- a prioritized list of **what to fix first**.

Every analysis is tied to the account that created it. Team members only ever
see their own projects and results.

### The pipeline

```
Sign in
  → Create project (GitHub URL)
  → Read-only repository scan (prioritized, capped)
  → Project context packed
  → AI analysis (your own key, or the built-in engine)
  → Validated structured result
  → Weighted health score
  → Strengths · Weaknesses · Priorities
```

### Scoring model

| Category          | Weight |
| ----------------- | ------ |
| Architecture      | 15%    |
| Code Quality      | 15%    |
| Security          | 15%    |
| Problem Definition| 10%    |
| Database          | 10%    |
| Testing           | 10%    |
| Documentation     | 10%    |
| Innovation        | 10%    |
| UX                | 5%     |

Category scores come from the AI (or the heuristic engine) and are clamped to
0–100 before the weighted average is computed, so a malformed response can
never produce an invalid score.

---

## Features

- **Email sign-in / sign-up** — one-time codes, plus a guest mode for quick
  trials. Real accounts, no passwords stored.
- **Project dashboard** — project cards with latest score, run counts, and a
  quick-create form.
- **Repository scan** — the backend reads the repo over the GitHub API:
  prioritized file selection (README and manifests first, then entry points,
  routes, services, components, schemas, tests), hard caps (50 files, 48 KB
  per file, 320 KB total), ignored directories (`node_modules`, `dist`,
  `.git`, …), and secret files (`.env` and friends) never fetched.
- **AI analysis** — evidence-only prompting: the model must ground every
  claim in the supplied context, respond in strict JSON, and mark anything it
  cannot establish as not verifiable. The response is validated and clamped
  before storage.
- **Bring your own key** — each user can save a personal AI key for Google
  Gemini, OpenAI (ChatGPT), Anthropic Claude, or OpenRouter (any of 100+
  models). Keys are stored server-side, never displayed again, and used only
  for that user's analyses.
- **Engine transparency** — every result shows which engine produced it
  (your key's provider, "Built-in AI", or an unlabeled heuristic run).
- **Demo mode** — a prepared sample analysis, clearly labeled as demo data,
  so the full flow can be explored with no external dependencies.
- **Admin area** — one-time bootstrap claim for the first admin, then member
  role management (user / member / admin), workspace stats, and a list of all
  projects. Admin functions re-verify the caller's role server-side.

### AI engine priority

Each analysis uses the first available engine:

1. the **user's own key** (Gemini / OpenAI / Claude / OpenRouter),
2. the server's `GEMINI_API_KEY`, if configured,
3. the **platform gateway** (built-in AI, when authorized),
4. a **deterministic heuristic** scan (structure and configuration signals;
   always available and honestly labeled as not an AI review).

A missing or invalid key never fails a run — it degrades to the next tier.

---

## Security architecture

- **Data isolation** — every query and mutation is ownership-scoped. Requesting
  another user's project returns "not found", never its data.
- **Key handling** — API keys are write-only from the client's perspective:
  save, status, and remove only. No query returns key material; clients see a
  masked preview such as `AIza…3f9a`. Provider calls happen exclusively in
  server-side actions.
- **Repository safety** — repository contents are treated as data. Code is
  never executed, dependencies are never installed, and shell commands are
  never derived from repository content. File reads are capped and filtered.
- **Input validation** — GitHub URLs must be `https://github.com/owner/repo`
  (other hosts, non-https schemes, and reserved namespaces such as
  `github.com/topics/...` are rejected); text fields are length-bounded;
  errors are mapped to friendly messages with no stack traces or internals.

---

## Technology stack

- **Frontend:** React 19, Vite, TypeScript, React Router, Tailwind CSS 4,
  shadcn/ui, Framer Motion
- **Backend & database:** Convex (queries, mutations, actions) with Convex
  Auth (email OTP + anonymous)
- **AI:** direct provider calls — Google Gemini, OpenAI, Anthropic Claude,
  OpenRouter — plus a platform gateway and a heuristic fallback
- **Testing:** Bun's built-in test runner
- **Theme:** dark premium neobrutalism — square corners, hard edges, offset
  shadows, flat color blocks, lime accent (Space Grotesk + JetBrains Mono)

---

## Project structure

```
├── index.html                  # entry, fonts, metadata
├── src/
│   ├── main.tsx                # router and providers
│   ├── index.css               # theme tokens and utilities
│   ├── pages/
│   │   ├── Landing.tsx         # public marketing page
│   │   ├── Auth.tsx            # email-otp sign-in / sign-up
│   │   ├── Dashboard.tsx       # project list, create, demo
│   │   ├── ProjectPage.tsx     # analysis view (score, findings)
│   │   ├── AdminPage.tsx       # admin area
│   │   ├── SettingsPage.tsx    # bring-your-own-key settings
│   │   └── NotFound.tsx
│   ├── components/
│   │   ├── nb.tsx              # neobrutalism UI kit
│   │   ├── AppHeader.tsx       # authenticated top bar
│   │   ├── RequireAuth.tsx     # route protection
│   │   └── ui/                 # shadcn primitives
│   ├── convex/
│   │   ├── schema.ts           # users, projects, analyses, aiKeys
│   │   ├── projects.ts         # project CRUD (ownership-scoped)
│   │   ├── analyses.ts         # scan + AI analysis action
│   │   ├── analysesStore.ts    # analysis storage and queries
│   │   ├── aiKeys.ts           # BYOK save/status/remove
│   │   ├── admin.ts            # role management and stats
│   │   └── lib/
│   │       ├── repo.ts         # URL parsing, file selection, context
│   │       ├── scoring.ts      # weighted score calculation
│   │       └── aiProviders.ts  # provider catalog and API calls
│   └── hooks/use-auth.ts
├── tests/
│   ├── repo.test.ts            # URL + file-selection security tests
│   ├── scoring.test.ts         # score math tests
│   └── aiProviders.test.ts     # provider catalog tests
└── package.json
```

---

## Getting started

Requirements: [Bun](https://bun.sh) 1.1+.

```bash
bun install
bun run dev          # frontend + Convex dev functions
```

The app runs at `http://localhost:5173`. The first Convex push creates the
tables automatically.

### Environment variables

| Variable             | Required | Purpose                                            |
| -------------------- | -------- | -------------------------------------------------- |
| `GEMINI_API_KEY`     | no       | Server-wide Gemini analysis (tier 2 engine)         |
| `GITHUB_TOKEN`       | no       | Raises GitHub API limits from ~60 to 5,000 req/hour |

Users supply their own keys through the app's **AI key** settings page — no
key configuration is required to run the project. Secret files (`.env`,
`.env.local`) are never committed and never fetched from scanned repositories.

### Scripts

```bash
bun run dev          # development server
bun test tests/      # unit tests (45 tests)
bunx tsc -b --noEmit # typecheck
bun run build        # production build
```

---

## Testing

```bash
bun test tests/
```

- **`repo.test.ts`** — GitHub URL parsing (protocol/host/path rules, reserved
  namespaces), file selection (ignored directories, secret-file blocking,
  binary exclusion, caps), and context packing.
- **`scoring.test.ts`** — weight sums, clamping, severity fallbacks, weighted
  averaging, renormalization with missing categories, unknown-key rejection.
- **`aiProviders.test.ts`** — catalog completeness, key masking guarantees,
  and key sanity validation.

---

## Current limitations

- **Public repositories only.** Private repos are rejected with a clear
  message; token-based private access is planned.
- **Latest analysis per project** — the UI shows the most recent run; a
  browsable history is planned.
- **Single key per user** — one AI key at a time; switching providers
  replaces it.
- Roadmap tracking, viva practice, and a project-aware chat are not part of
  this version.

---

## Responsible AI use

The analysis engine is instructed to ground every claim in repository
evidence, to mark anything unverifiable explicitly, and never to fabricate
files, routes, or features. Results are decision support for reviewers — not
a substitute for human judgment — and every finding can be checked against
the cited file paths.
