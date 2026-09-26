import { useAction, useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  CircleX,
  FileSearch,
  Github,
  Loader2,
  Play,
  Sparkles,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { AppHeader } from "@/components/AppHeader";
import { NBBadge, NBButton, NBPanel, NBScoreBar } from "@/components/nb";
import { api } from "@/convex/_generated/api";
import { AI_PROVIDER_INFO, type AIProvider } from "@/convex/lib/aiProviders";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";

const STAGES = [
  { key: "scanning", label: "Reading repository" },
  { key: "analyzing", label: "Reviewing architecture" },
  { key: "complete", label: "Preparing findings" },
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_GITHUB_URL:
    "This project has no valid GitHub repository attached. Create a new project with a repository URL.",
  REPOSITORY_NOT_FOUND_OR_PRIVATE:
    "Repository not found. Check the URL — private repositories aren't supported in V1.",
  GITHUB_RATE_LIMIT:
    "GitHub's temporary rate limit was hit. Please try again in a few minutes.",
  REPOSITORY_UNREACHABLE:
    "GitHub couldn't be reached. Check your connection and try again.",
  EMPTY_REPOSITORY: "That repository has no files to analyze.",
  AI_REQUEST_FAILED:
    "The AI service didn't respond. Please try again in a moment.",
  AI_RESPONSE_MALFORMED:
    "The AI returned an unexpected response. Please try again.",
  PROJECT_NOT_FOUND: "Project not found.",
  UNAUTHENTICATED: "Please sign in again.",
};

/** Count-up animation for the big score number. */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);
  return value;
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const typedProjectId = projectId as Id<"projects"> | undefined;
  const project = useQuery(
    api.projects.get,
    typedProjectId ? { projectId: typedProjectId } : "skip",
  );
  const analysis = useQuery(
    api.analysesStore.getLatest,
    typedProjectId ? { projectId: typedProjectId } : "skip",
  );
  const markFailed = useMutation(api.analysesStore.markFailed);
  const startAnalysis = useAction(api.analyses.start);
  const keyStatus = useQuery(api.aiKeys.status, {});

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRunning = running || analysis?.status === "scanning" || analysis?.status === "analyzing";

  const handleAnalyze = async () => {
    if (!typedProjectId) return;
    setError(null);
    setRunning(true);
    try {
      await startAnalysis({ projectId: typedProjectId });
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        ERROR_MESSAGES[code] ??
          "Analysis failed. Please wait a moment and try again.",
      );
      // Reflect the failure in the stored analysis so the UI stays truthful.
      try {
        await markFailed({
          projectId: typedProjectId,
          error: code || "ANALYSIS_FAILED",
        });
      } catch {
        // non-fatal
      }
    } finally {
      setRunning(false);
    }
  };

  const result = analysis?.result;
  const animatedScore = useCountUp(result?.score ?? 0);
  const activeStage = useMemo(() => {
    if (!isRunning) return null;
    return analysis?.stage === "analyzing" ? "analyzing" : "scanning";
  }, [isRunning, analysis?.stage]);

  if (authLoading || project === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div>
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <NBPanel className="mx-auto max-w-md p-8">
            <CircleX className="mx-auto size-10 text-nb-red" />
            <h1 className="mt-3 text-xl font-bold">Project not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This project doesn't exist or belongs to another account.
            </p>
            <Link to="/dashboard" className="mt-5 inline-block">
              <NBButton variant="primary">
                <ArrowLeft className="size-4" />
                Back to dashboard
              </NBButton>
            </Link>
          </NBPanel>
        </main>
      </div>
    );
  }

  const stageIndex = (key: string) => STAGES.findIndex((s) => s.key === key);

  return (
    <div>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/dashboard"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            All projects
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {project.name}
                </h1>
                {project.source === "demo" ? (
                  <NBBadge tone="purple">Demo analysis</NBBadge>
                ) : (
                  <NBBadge tone="yellow">GitHub</NBBadge>
                )}
              </div>
              {project.description && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {project.description}
                </p>
              )}
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  <Github className="size-3.5" />
                  {project.githubOwner}/{project.githubRepo}
                </a>
              )}
            </div>
            <NBButton
              variant="primary"
              onClick={handleAnalyze}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  {project.lastScore !== undefined
                    ? "Re-analyze"
                    : "Analyze project"}
                </>
              )}
            </NBButton>
          </div>
        </div>

        {error && (
          <p className="mb-6 flex items-start gap-2 border-2 border-edge bg-nb-red px-4 py-3 text-sm font-semibold text-accent-ink">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent-ink" />
            {error}
          </p>
        )}

        {/* Live progress — reflects actual backend stages */}
        <AnimatePresence>
          {isRunning && !result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6"
            >
              <NBPanel className="p-5">
                <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
                  <Sparkles className="size-4 text-primary" />
                  Analyzing your project…
                </p>
                <ul className="mt-4 space-y-2.5">
                  {STAGES.map((stage) => {
                    const currentIdx = stageIndex(activeStage ?? "scanning");
                    const idx = stageIndex(stage.key);
                    const done = idx < currentIdx;
                    const active = idx === currentIdx;
                    return (
                      <li
                        key={stage.key}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        {done ? (
                          <span className="flex h-5 w-5 items-center justify-center border-2 border-edge bg-nb-green">
                            <Check className="size-3.5 text-accent-ink" strokeWidth={3} />
                          </span>
                        ) : active ? (
                          <Loader2 className="size-5 animate-spin text-primary" />
                        ) : (
                          <span className="h-5 w-5 border-2 border-edge opacity-40" />
                        )}
                        <span
                          className={
                            done
                              ? "font-semibold"
                              : active
                                ? "font-bold"
                                : "text-muted-foreground"
                          }
                        >
                          {stage.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </NBPanel>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Failed state */}
        {analysis?.status === "failed" && !isRunning && (
          <NBPanel className="mb-6 border-2 border-edge bg-nb-red/10 p-5">
            <p className="flex items-center gap-2 text-sm font-bold">
              <CircleAlert className="size-4" />
              Last analysis failed
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {ERROR_MESSAGES[analysis.error ?? ""] ??
                "Something went wrong. Please try again."}
            </p>
          </NBPanel>
        )}

        {/* Empty state */}
        {project.lastScore === undefined &&
          !isRunning &&
          analysis?.status !== "failed" && (
            <NBPanel className="flex flex-col items-center px-6 py-14 text-center">
              <span className="flex h-14 w-14 items-center justify-center border-2 border-edge bg-primary nb-shadow-sm">
                <FileSearch className="size-7 text-accent-ink" />
              </span>
              <h2 className="mt-4 text-xl font-bold">Ready to analyze</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {project.source === "demo"
                  ? "Run the demo to see a full analysis with prepared sample data."
                  : "We'll read the repository and score it across nine categories."}
              </p>
              {project.source !== "demo" && keyStatus && !keyStatus.hasKey && (
                <p className="mt-5 border-2 border-edge bg-secondary px-3 py-2 text-xs text-muted-foreground">
                  Running on the built-in engine. For sharper, model-powered
                  reviews,{" "}
                  <Link
                    to="/settings"
                    className="font-bold text-primary underline underline-offset-2"
                  >
                    add your AI key
                  </Link>
                  .
                </p>
              )}
              <NBButton
                variant="primary"
                className="mt-6"
                onClick={handleAnalyze}
              >
                <Play className="size-4" />
                {project.source === "demo"
                  ? "Run demo analysis"
                  : "Analyze project"}
              </NBButton>
            </NBPanel>
          )}

        {/* Results */}
        {result && !isRunning && (
          <div className="space-y-6">
            {analysis?.isDemo && (
              <p className="border-2 border-edge bg-nb-purple px-4 py-2.5 text-center text-xs font-bold uppercase tracking-widest text-accent-ink">
                Demo analysis — prepared sample data, not a live repository scan
              </p>
            )}

            {/* Score */}
            <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
              <NBPanel className="p-6">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Project Health
                  </p>
                  {analysis?.aiEngine && analysis.aiEngine !== "heuristic" && (
                    <NBBadge tone="lime">
                      {analysis.aiEngine === "gemini"
                        ? "Gemini"
                        : analysis.aiEngine === "openai"
                          ? "OpenAI"
                          : analysis.aiEngine === "claude"
                            ? "Claude"
                            : analysis.aiEngine === "openrouter"
                              ? "OpenRouter"
                              : analysis.aiEngine === "gateway"
                                ? "Built-in AI"
                                : analysis.aiEngine}
                    </NBBadge>
                  )}
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-7xl font-bold leading-none tracking-tight">
                    {animatedScore}
                  </span>
                  <span className="pb-1.5 text-xl font-semibold text-muted-foreground">
                    / 100
                  </span>
                </div>
                <div className="mt-4">
                  <NBScoreBar value={result.score} />
                </div>
                <p className="mt-4 border-2 border-edge bg-primary px-3 py-2 text-sm font-bold text-accent-ink">
                  {result.verdict}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {result.summary}
                </p>
                {analysis?.repoMeta && (
                  <p className="mt-4 border-t-2 border-edge pt-3 text-xs font-semibold text-muted-foreground">
                    {analysis.repoMeta.scannedFileCount} files scanned ·{" "}
                    {analysis.repoMeta.language ?? "language unknown"} ·{" "}
                    {analysis.repoMeta.defaultBranch} branch
                  </p>
                )}
              </NBPanel>

              {/* Categories */}
              <NBPanel className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Category scores
                </p>
                <div className="mt-4 space-y-4">
                  {result.categories.map((cat) => (
                    <div key={cat.key}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold">{cat.name}</span>
                        <span className="text-sm font-bold">
                          {cat.score}
                          <span className="ml-1 text-[10px] font-semibold uppercase text-muted-foreground">
                            w {Math.round(cat.weight * 100)}%
                          </span>
                        </span>
                      </div>
                      <NBScoreBar value={cat.score} />
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {cat.comment}
                      </p>
                    </div>
                  ))}
                </div>
              </NBPanel>
            </div>

            {/* Strengths + weaknesses */}
            <div className="grid gap-6 md:grid-cols-2">
              <NBPanel className="p-6">
                <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                  <span className="flex h-6 w-6 items-center justify-center border-2 border-edge bg-nb-green">
                    <ThumbsUp className="size-3.5 text-accent-ink" />
                  </span>
                  Strengths
                </p>
                {result.strengths.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No clear strengths identified from the available evidence.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {result.strengths.map((s, i) => (
                      <motion.li
                        key={s.title}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="border-2 border-edge bg-card p-3.5"
                      >
                        <p className="text-sm font-bold">{s.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {s.detail}
                        </p>
                        {s.evidence && s.evidence.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {s.evidence.map((e) => (
                              <NBBadge key={e} tone="green" className="max-w-full">
                                <span className="truncate font-mono text-[10px]">
                                  {e}
                                </span>
                              </NBBadge>
                            ))}
                          </div>
                        )}
                      </motion.li>
                    ))}
                  </ul>
                )}
              </NBPanel>

              <NBPanel className="p-6">
                <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                  <span className="flex h-6 w-6 items-center justify-center border-2 border-edge bg-nb-red">
                    <CircleAlert className="size-3.5 text-accent-ink" />
                  </span>
                  Weaknesses
                </p>
                {result.weaknesses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No weaknesses identified from the available evidence.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {result.weaknesses.map((w, i) => (
                      <motion.li
                        key={w.title}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="border-2 border-edge bg-card p-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-bold">{w.title}</p>
                          <NBBadge
                            tone={
                              w.severity === "critical" || w.severity === "high"
                                ? "red"
                                : w.severity === "medium"
                                  ? "yellow"
                                  : "paper"
                            }
                          >
                            {w.severity}
                          </NBBadge>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {w.detail}
                        </p>
                        {w.evidence && w.evidence.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {w.evidence.map((e) => (
                              <NBBadge key={e} tone="paper" className="max-w-full">
                                <span className="truncate font-mono text-[10px]">
                                  {e}
                                </span>
                              </NBBadge>
                            ))}
                          </div>
                        )}
                      </motion.li>
                    ))}
                  </ul>
                )}
              </NBPanel>
            </div>

            {/* Next steps */}
            {result.nextSteps.length > 0 && (
              <NBPanel className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  What to fix first
                </p>
                <ol className="mt-4 space-y-2.5">
                  {result.nextSteps.map((step, i) => (
                    <li key={step} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-edge bg-ink font-mono text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="text-sm leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </NBPanel>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
