import { motion } from "framer-motion";
import {
  ArrowRight,
  CircleAlert,
  FileSearch,
  Gauge,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";
import { Link } from "react-router";
import { NBBadge, NBButton, NBPanel, NBScoreBar } from "@/components/nb";
import { useAuth } from "@/hooks/use-auth";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Submit a repository",
    detail: "Paste a public GitHub URL. That's the whole form.",
  },
  {
    step: "02",
    title: "We read the code",
    detail: "Structure, config, and key source files — read-only, never executed.",
  },
  {
    step: "03",
    title: "The analysis engine scores it",
    detail: "Nine weighted categories rated from real files, not guesswork.",
  },
  {
    step: "04",
    title: "Read the findings",
    detail: "A transparent health score with evidence-backed strengths and weaknesses.",
  },
];

const FEATURES = [
  {
    icon: Gauge,
    title: "Health Score",
    detail: "One number from nine weighted categories. Explainable, not magic.",
    tone: "bg-primary",
  },
  {
    icon: FileSearch,
    title: "Repository Analysis",
    detail: "Prioritized file reading with hard caps. Nothing runs, nothing executes.",
    tone: "bg-nb-purple",
  },
  {
    icon: ThumbsUp,
    title: "Strengths",
    detail: "What a project genuinely does well, backed by file evidence.",
    tone: "bg-nb-green",
  },
  {
    icon: CircleAlert,
    title: "Weaknesses",
    detail: "What needs work, ranked by severity from critical to low.",
    tone: "bg-nb-red",
  },
];

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const primaryHref = isAuthenticated ? "/dashboard" : "/auth";

  return (
    <div className="min-h-screen">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b-2 border-edge bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center border-2 border-edge bg-primary nb-shadow-sm">
              <Gauge className="size-5 text-accent-ink" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-bold uppercase tracking-wide">
              Project Mentor AI
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            {!isLoading && isAuthenticated ? (
              <Link to="/dashboard">
                <NBButton size="sm" variant="ink">
                  Dashboard
                </NBButton>
              </Link>
            ) : (
              <>
                <Link to="/auth" className="hidden sm:block">
                  <NBButton size="sm" variant="ghost">
                    Sign in
                  </NBButton>
                </Link>
                <Link to="/auth">
                  <NBButton size="sm" variant="primary">
                    Get Started
                  </NBButton>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="border-b-2 border-edge">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.15fr_0.85fr] md:items-center md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <NBBadge tone="lime" className="mb-5">
              Internal · Project Analysis
            </NBBadge>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Your project deserves{" "}
              <span className="inline-block -rotate-1 border-2 border-edge bg-primary px-2 text-accent-ink nb-shadow-sm">
                more
              </span>{" "}
              than a code generator.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Project Mentor AI reads a repository, scores it across nine
              engineering categories, and shows exactly what is strong, what is
              weak, and what to fix first — before it reaches a client demo.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to={primaryHref}>
                <NBButton size="lg" variant="primary">
                  Analyze a Project
                  <ArrowRight className="size-4" />
                </NBButton>
              </Link>
              <Link to="/auth">
                <NBButton size="lg" variant="outline">
                  Sign in
                </NBButton>
              </Link>
            </div>
            <p className="mt-5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Built for the team · Public repositories · Read-only scans
            </p>
          </motion.div>

          {/* Score mock — shows the actual product output */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
          >
            <NBPanel className="rotate-1 p-5">
              <div className="mb-4 flex items-center justify-between border-b-2 border-edge pb-3">
                <span className="text-xs font-bold uppercase tracking-widest">
                  Project Health
                </span>
                <NBBadge tone="green">Sample</NBBadge>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-6xl font-bold leading-none tracking-tight">
                  78
                </span>
                <span className="pb-1 text-lg font-semibold text-muted-foreground">
                  / 100
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  ["Architecture", 74],
                  ["Security", 61],
                  ["Code Quality", 83],
                  ["Testing", 42],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <div className="mb-1 flex justify-between text-xs font-semibold">
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                    <NBScoreBar value={value as number} />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t-2 border-edge pt-4">
                <NBBadge tone="green">+ README present</NBBadge>
                <NBBadge tone="red">− no tests found</NBBadge>
                <NBBadge tone="yellow">− config hygiene</NBBadge>
              </div>
            </NBPanel>
          </motion.div>
        </div>
      </section>

      {/* ── Marquee ─────────────────────────────────────────────────────── */}
      <div className="overflow-hidden border-b-2 border-edge bg-primary py-2.5">
        <div className="nb-marquee">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="flex shrink-0 items-center gap-8 pr-8 text-sm font-bold uppercase tracking-widest text-accent-ink"
              aria-hidden={copy === 1}
            >
              {[
                "Health Score",
                "Strengths",
                "Weaknesses",
                "Evidence-Based",
                "Read-Only Scans",
                "GitHub Repos",
                "Actionable Fixes",
              ].map((word) => (
                <span key={word} className="flex items-center gap-8">
                  {word}
                  <span>✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="border-b-2 border-edge bg-secondary">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <div className="mb-10 flex items-end justify-between gap-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <span className="hidden text-xs font-bold uppercase tracking-widest text-muted-foreground sm:block">
              Four steps. No fluff.
            </span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
              >
                <NBPanel className="h-full p-5">
                  <span className="inline-block border-2 border-edge bg-ink px-2 py-0.5 font-mono text-xs font-bold text-primary">
                    {item.step}
                  </span>
                  <h3 className="mt-3 text-lg font-bold leading-snug">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.detail}
                  </p>
                </NBPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="border-b-2 border-edge">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <h2 className="mb-10 text-3xl font-bold tracking-tight sm:text-4xl">
            What you get
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
              >
                <NBPanel className="h-full p-5">
                  <span
                    className={`mb-4 inline-flex h-11 w-11 items-center justify-center border-2 border-edge ${feature.tone}`}
                  >
                    <feature.icon
                      className="size-5 text-accent-ink"
                      strokeWidth={2.25}
                    />
                  </span>
                  <h3 className="text-lg font-bold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.detail}
                  </p>
                </NBPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ────────────────────────────────────────────────────── */}
      <section className="border-b-2 border-edge bg-secondary">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid items-start gap-8 md:grid-cols-[auto_1fr_1fr]">
            <span className="hidden h-14 w-14 items-center justify-center border-2 border-edge bg-nb-green nb-shadow md:flex">
              <ShieldCheck className="size-7 text-accent-ink" strokeWidth={2.25} />
            </span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Your code stays yours
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Every project and analysis is tied to the account that created
                it. Team members only ever see their own repositories, scores,
                and findings.
              </p>
            </div>
            <ul className="space-y-2.5 text-sm">
              {[
                "Repositories are read over HTTPS — never cloned, built, or executed",
                "File reading is capped and filtered; secret files are skipped",
                "API keys and tokens stay server-side, never in the browser",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 border border-edge bg-primary" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-4 py-20 text-center sm:px-6">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Stop guessing.{" "}
            <span className="inline-block -rotate-1 border-2 border-edge bg-nb-green px-2 text-accent-ink nb-shadow-sm">
              Start knowing.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            One repository URL is all it takes to see where a project stands.
          </p>
          <div className="mt-8">
            <Link to={primaryHref}>
              <NBButton size="lg" variant="primary">
                Analyze a Project
                <ArrowRight className="size-4" />
              </NBButton>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t-2 border-edge bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:flex-row sm:px-6">
          <span className="flex items-center gap-2 text-foreground">
            <Gauge className="size-4" />
            Project Mentor AI
          </span>
          <span>Understand · Analyze · Improve</span>
        </div>
      </footer>
    </div>
  );
}
