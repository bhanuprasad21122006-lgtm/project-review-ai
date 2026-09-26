import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  FolderGit2,
  Gauge,
  Github,
  Plus,
  SquarePlus,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AppHeader } from "@/components/AppHeader";
import {
  NBBadge,
  NBButton,
  NBInput,
  NBLabel,
  NBPanel,
  NBScoreBar,
} from "@/components/nb";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";

type Project = Doc<"projects">;

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_GITHUB_URL:
    "That doesn't look like a GitHub repository URL. Use https://github.com/owner/repo.",
  INVALID_NAME: "Project name must be between 1 and 120 characters.",
  DESCRIPTION_TOO_LONG: "Description is limited to 600 characters.",
  UNAUTHENTICATED: "Please sign in again.",
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const projects = useQuery(api.projects.list, {});
  const createProject = useMutation(api.projects.create);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingDemo, setCreatingDemo] = useState(false);

  const analyzed = (projects ?? []).filter((p) => p.lastScore !== undefined);
  const avgScore =
    analyzed.length > 0
      ? Math.round(
          analyzed.reduce((sum, p) => sum + (p.lastScore ?? 0), 0) /
            analyzed.length,
        )
      : null;

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { projectId } = await createProject({
        name: name.trim(),
        githubUrl: githubUrl.trim() || undefined,
        description: description.trim() || undefined,
      });
      setName("");
      setGithubUrl("");
      setDescription("");
      setShowForm(false);
      navigate(`/projects/${projectId}`);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        ERROR_MESSAGES[code] ??
          "Something went wrong while creating the project. Please try again.",
      );
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setCreatingDemo(true);
    try {
      const { projectId } = await createProject({
        name: "Demo Student Showcase",
        description:
          "Prepared demo project used to preview the analysis flow without a live repository scan.",
      });
      navigate(`/projects/${projectId}`);
    } catch {
      setError(
        "Something went wrong while creating the demo project. Please try again.",
      );
      setCreatingDemo(false);
    }
  };

  return (
    <div>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {/* Heading */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Workspace
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {user?.name ? `Welcome, ${user.name}` : "Your projects"}
            </h1>
          </div>
          <NBButton
            variant="primary"
            onClick={() => setShowForm((v) => !v)}
            aria-expanded={showForm}
          >
            {showForm ? "Close" : (<><Plus className="size-4" /> New project</>)}
          </NBButton>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NBPanel className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center border-2 border-ink bg-nb-purple">
                <FolderGit2 className="size-5 text-ink" />
              </span>
              <div>
                <p className="text-2xl font-bold leading-none">
                  {projects === undefined ? "…" : projects.length}
                </p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Projects
                </p>
              </div>
            </div>
          </NBPanel>
          <NBPanel className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center border-2 border-ink bg-primary">
                <Gauge className="size-5 text-ink" />
              </span>
              <div>
                <p className="text-2xl font-bold leading-none">
                  {avgScore ?? "—"}
                </p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Avg score
                </p>
              </div>
            </div>
          </NBPanel>
          <NBPanel className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center border-2 border-ink bg-nb-green">
                <SquarePlus className="size-5 text-ink" />
              </span>
              <div>
                <p className="text-2xl font-bold leading-none">
                  {analyzed.length}
                </p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Analyzed
                </p>
              </div>
            </div>
          </NBPanel>
        </div>

        {/* Create form */}
        {showForm && (
          <NBPanel className="mb-8">
            <form onSubmit={handleCreate}>
              <div className="border-b-2 border-ink bg-primary px-5 py-3">
                <h2 className="text-sm font-bold uppercase tracking-widest">
                  New project
                </h2>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <NBLabel htmlFor="project-name">Project name *</NBLabel>
                    <NBInput
                      id="project-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="AI Agriculture Assistant"
                      maxLength={120}
                      required
                    />
                  </div>
                  <div>
                    <NBLabel htmlFor="project-url">GitHub URL</NBLabel>
                    <div className="relative">
                      <Github className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <NBInput
                        id="project-url"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        placeholder="https://github.com/you/your-repo"
                        className="pl-9"
                        type="url"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <NBLabel htmlFor="project-desc">Description</NBLabel>
                  <NBInput
                    id="project-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this project do? (optional)"
                    maxLength={600}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Public repositories only in V1. The repo is read over HTTPS —
                  nothing is ever executed.
                </p>
                {error && (
                  <p className="border-2 border-ink bg-destructive px-3 py-2 text-xs font-semibold text-white">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <NBButton type="submit" variant="ink" disabled={submitting}>
                    {submitting ? "Creating…" : "Create project"}
                  </NBButton>
                  <NBButton
                    type="button"
                    variant="outline"
                    onClick={handleDemo}
                    disabled={creatingDemo}
                  >
                    {creatingDemo ? "Loading…" : "Load demo project"}
                  </NBButton>
                </div>
              </div>
            </form>
          </NBPanel>
        )}

        {/* Error banner (demo creation failure) */}
        {!showForm && error && (
          <p className="mb-8 flex items-center gap-2 border-2 border-ink bg-destructive px-3 py-2 text-xs font-semibold text-white">
            <TriangleAlert className="size-4" />
            {error}
          </p>
        )}

        {/* Project list */}
        {projects === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <NBPanel key={i} className="h-40 animate-pulse bg-muted" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <NBPanel className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center border-2 border-ink bg-primary nb-shadow-sm">
              <FolderGit2 className="size-7 text-ink" />
            </span>
            <h2 className="mt-4 text-xl font-bold">No projects yet</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Create a project with a GitHub repository URL, or load the demo
              project to see how analysis works.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <NBButton variant="primary" onClick={() => setShowForm(true)}>
                <Plus className="size-4" />
                New project
              </NBButton>
              <NBButton variant="outline" onClick={handleDemo} disabled={creatingDemo}>
                Load demo project
              </NBButton>
            </div>
          </NBPanel>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project._id} to={`/projects/${project._id}`}>
                <NBPanel className="h-full transition-[transform,box-shadow] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--ink)]">
                  <div className="flex items-start justify-between gap-2 border-b-2 border-ink px-5 py-3">
                    <h3 className="truncate text-base font-bold">
                      {project.name}
                    </h3>
                    {project.source === "demo" ? (
                      <NBBadge tone="purple">Demo</NBBadge>
                    ) : (
                      <NBBadge tone="paper">GitHub</NBBadge>
                    )}
                  </div>
                  <div className="px-5 py-4">
                    {project.lastScore !== undefined ? (
                      <>
                        <div className="mb-1 flex items-end justify-between">
                          <span className="text-3xl font-bold leading-none">
                            {project.lastScore}
                            <span className="ml-1 text-sm font-semibold text-muted-foreground">
                              /100
                            </span>
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                            {project.analysisCount > 1
                              ? `${project.analysisCount} runs`
                              : "1 run"}
                          </span>
                        </div>
                        <NBScoreBar value={project.lastScore} />
                      </>
                    ) : (
                      <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <TriangleAlert className="size-4" />
                        Not analyzed yet
                      </p>
                    )}
                    {project.githubUrl && (
                      <p className="mt-3 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <Github className="size-3.5 shrink-0" />
                        {project.githubOwner}/{project.githubRepo}
                      </p>
                    )}
                    <p className="mt-3 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-ink">
                      Open
                      <ArrowRight className="size-3.5" />
                    </p>
                  </div>
                </NBPanel>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
