import { useMutation, useQuery } from "convex/react";
import {
  FolderGit2,
  Gauge,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { NBBadge, NBButton, NBPanel } from "@/components/nb";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";

export default function AdminPage() {
  const { user } = useAuth();
  const viewer = useQuery(api.admin.me, {});
  const slotOpen = useQuery(api.admin.adminSlotOpen, {});
  const overview = useQuery(api.admin.overview, {});
  const users = useQuery(api.admin.listUsers, {});
  const projects = useQuery(api.admin.listAllProjects, {});
  const claimAdmin = useMutation(api.admin.claimAdmin);
  const setRole = useMutation(api.admin.setRole);

  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = viewer?.role === "admin";
  const canClaim = viewer !== undefined && slotOpen === true && !isAdmin;

  const handleClaim = async () => {
    setClaiming(true);
    setError(null);
    try {
      await claimAdmin();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "ADMIN_EXISTS"
          ? "An admin already exists. Ask them to grant you the role."
          : "Could not claim the admin role. Try again.",
      );
    } finally {
      setClaiming(false);
    }
  };

  const handleSetRole = async (
    userId: Id<"users">,
    role: "admin" | "user" | "member",
  ) => {
    setError(null);
    try {
      await setRole({ userId, role });
    } catch {
      setError("Could not update the role. Try again.");
    }
  };

  return (
    <div>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Workspace
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Admin area</h1>
          </div>
          {isAdmin && <NBBadge tone="lime">Admin</NBBadge>}
        </div>

        {/* Bootstrap: claim admin when the workspace has none */}
        {canClaim && (
          <NBPanel className="mb-8">
            <div className="border-b-2 border-edge bg-primary px-5 py-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-accent-ink">
                No admin yet
              </h2>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                This workspace has no administrator yet. The first person to
                claim the role becomes its admin and can manage member roles
                from this page. You are signed in as{" "}
                <strong className="text-foreground">{user?.email}</strong>.
              </p>
              {error && (
                <p className="mt-3 border-2 border-edge bg-nb-red px-3 py-2 text-xs font-semibold text-accent-ink">
                  {error}
                </p>
              )}
              <NBButton className="mt-4" onClick={handleClaim} disabled={claiming}>
                {claiming ? "Claiming…" : "Claim admin role"}
              </NBButton>
            </div>
          </NBPanel>
        )}

        {!isAdmin && !canClaim && (
          <NBPanel className="mx-auto max-w-md p-8 text-center">
            <ShieldCheck className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-bold">Admin access required</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This area is restricted to workspace administrators. If you need
              access, ask an admin to grant your account the admin role.
            </p>
            {error && (
              <p className="mt-4 border-2 border-edge bg-nb-red px-3 py-2 text-xs font-semibold text-accent-ink">
                {error}
              </p>
            )}
          </NBPanel>
        )}

        {isAdmin && (
          <>
            {/* Source download */}
            <NBPanel className="mb-8 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">Full project source</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Complete codebase as a zip — dependencies and generated
                    files excluded (run `bun install` after unzipping).
                  </p>
                </div>
                <a href="/project-mentor-ai.zip" download>
                  <NBButton variant="primary">Download source (.zip)</NBButton>
                </a>
              </div>
            </NBPanel>

            {/* Stats */}
            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: "Users", value: overview?.totalUsers, icon: Users, tone: "bg-nb-purple" },
                { label: "Projects", value: overview?.totalProjects, icon: FolderGit2, tone: "bg-primary" },
                { label: "Analyses", value: overview?.totalAnalyses, icon: Gauge, tone: "bg-nb-green" },
                {
                  label: "Avg score",
                  value: overview?.avgScore ?? "—",
                  icon: Gauge,
                  tone: "bg-nb-blue",
                },
              ].map((stat) => (
                <NBPanel key={stat.label} className="p-5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center border-2 border-edge ${stat.tone}`}
                    >
                      <stat.icon className="size-5 text-accent-ink" />
                    </span>
                    <div>
                      <p className="text-2xl font-bold leading-none">
                        {stat.value ?? "…"}
                      </p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                </NBPanel>
              ))}
            </div>

            {error && (
              <p className="mb-6 border-2 border-edge bg-nb-red px-3 py-2 text-xs font-semibold text-accent-ink">
                {error}
              </p>
            )}

            {/* Users */}
            <NBPanel className="mb-8">
              <div className="border-b-2 border-edge px-5 py-3">
                <h2 className="text-sm font-bold uppercase tracking-widest">
                  Members
                </h2>
              </div>
              {users === undefined ? (
                <div className="flex justify-center px-5 py-10">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ul>
                  {users.map((u) => (
                    <li
                      key={u.userId}
                      className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-edge px-5 py-3.5 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {u.name ?? u.email ?? "Anonymous user"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {u.isAnonymous
                            ? "Guest session"
                            : (u.email ?? "no email")}{" "}
                          · {u.projectCount} project
                          {u.projectCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <NBBadge tone={u.role === "admin" ? "lime" : "paper"}>
                          {u.role ?? "user"}
                        </NBBadge>
                        <select
                          aria-label={`Role for ${u.email ?? "user"}`}
                          value={u.role ?? "user"}
                          onChange={(e) =>
                            handleSetRole(
                              u.userId,
                              e.target.value as "admin" | "user" | "member",
                            )
                          }
                          className="h-8 border-2 border-edge bg-card px-2 text-xs font-semibold text-foreground outline-none focus:border-primary/70"
                        >
                          <option value="user">user</option>
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                        </select>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </NBPanel>

            {/* Projects */}
            <NBPanel>
              <div className="border-b-2 border-edge px-5 py-3">
                <h2 className="text-sm font-bold uppercase tracking-widest">
                  All projects
                </h2>
              </div>
              {projects === undefined ? (
                <div className="flex justify-center px-5 py-10">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : projects.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No projects have been created yet.
                </p>
              ) : (
                <ul>
                  {projects.map((p) => (
                    <li
                      key={p.projectId}
                      className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-edge px-5 py-3.5 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{p.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {p.ownerEmail ?? "unknown owner"} ·{" "}
                          {p.source === "demo" ? "demo source" : "GitHub"} ·{" "}
                          {p.analysisCount} analysis
                          {p.analysisCount === 1 ? "" : "es"}
                        </p>
                      </div>
                      {p.lastScore !== null ? (
                        <NBBadge
                          tone={
                            p.lastScore >= 70
                              ? "green"
                              : p.lastScore >= 40
                                ? "yellow"
                                : "red"
                          }
                        >
                          {p.lastScore}/100
                        </NBBadge>
                      ) : (
                        <NBBadge tone="paper">Not analyzed</NBBadge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </NBPanel>
          </>
        )}
      </main>
    </div>
  );
}
