import { useQuery } from "convex/react";
import { Gauge, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { NBButton } from "@/components/nb";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";

export function AppHeader() {
  const { user, signOut } = useAuth();
  const viewer = useQuery(api.admin.me, {});
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-20 border-b-2 border-edge bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center border-2 border-edge bg-primary nb-shadow-sm">
            <Gauge className="size-5 text-accent-ink" strokeWidth={2.5} />
          </span>
          <span className="hidden text-sm font-bold uppercase tracking-wide sm:block">
            Project Mentor AI
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="flex items-center gap-1.5 border-2 border-edge bg-card px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-foreground hover:border-primary"
          >
            <KeyRound className="size-3.5 text-primary" />
            <span className="hidden sm:inline">AI key</span>
          </Link>
          {viewer?.role === "admin" && (
            <Link
              to="/admin"
              className="hidden items-center gap-1.5 border-2 border-edge bg-card px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-foreground hover:border-primary sm:flex"
            >
              <ShieldCheck className="size-3.5 text-primary" />
              Admin
            </Link>
          )}
          {user?.email && (
            <span className="hidden max-w-52 truncate border-2 border-edge bg-card px-2.5 py-1 text-xs font-semibold md:block">
              {user.email}
            </span>
          )}
          <NBButton size="sm" variant="ghost" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Sign out
          </NBButton>
        </div>
      </div>
    </header>
  );
}
