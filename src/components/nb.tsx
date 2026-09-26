import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Neobrutalism kit — dark premium technical edition.
 * Square corners, hard edges, offset shadows, flat accent blocks.
 * Text on bright accent blocks uses `text-accent-ink` for readability.
 */

// ── Panel ───────────────────────────────────────────────────────────────────

export function NBPanel({
  children,
  className,
  as: Tag = "div",
}: {
  children?: ReactNode;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  return (
    <Tag className={cn("nb-block nb-shadow bg-card text-card-foreground", className)}>
      {children}
    </Tag>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

type NBButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ink" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function NBButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: NBButtonProps) {
  return (
    <button
      data-nb-button={variant}
      className={cn(
        // base
        "inline-flex items-center justify-center gap-2 border-2 border-edge font-bold uppercase tracking-wide",
        "transition-[transform,box-shadow] duration-100 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        // pressable: hover lifts, active presses into the shadow
        "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#000]",
        "active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
        // sizes
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-5 text-sm",
        size === "lg" && "h-12 px-7 text-base",
        // variants — flat blocks, accent-ink for contrast on bright fills
        variant === "primary" && "nb-shadow bg-primary text-accent-ink",
        variant === "ink" && "nb-shadow bg-ink text-ink-inverse",
        variant === "outline" && "nb-shadow bg-card text-foreground",
        variant === "danger" && "nb-shadow bg-destructive text-accent-ink",
        variant === "ghost" && "bg-transparent text-foreground shadow-none",
        className,
      )}
      {...props}
    />
  );
}

// ── Inputs ──────────────────────────────────────────────────────────────────

export function NBInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full border-2 border-edge bg-card px-3 py-2 text-sm font-medium text-foreground",
        "placeholder:font-normal placeholder:text-muted-foreground",
        "outline-none transition-shadow",
        "focus:border-primary/70 focus:shadow-[3px_3px_0_0_#000]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function NBLabel({
  children,
  htmlFor,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1.5 block text-xs font-bold uppercase tracking-widest text-foreground",
        className,
      )}
    >
      {children}
    </label>
  );
}

// ── Badge / tag ─────────────────────────────────────────────────────────────

export function NBBadge({
  children,
  tone = "paper",
  className,
}: {
  children: ReactNode;
  tone?:
    | "paper"
    | "yellow"
    | "green"
    | "blue"
    | "red"
    | "purple"
    | "ink"
    | "lime";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border-2 border-edge px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        tone === "paper" && "bg-card text-foreground",
        tone === "yellow" && "bg-nb-yellow text-accent-ink",
        tone === "green" && "bg-nb-green text-accent-ink",
        tone === "blue" && "bg-nb-blue text-accent-ink",
        tone === "red" && "bg-nb-red text-accent-ink",
        tone === "purple" && "bg-nb-purple text-accent-ink",
        tone === "lime" && "bg-primary text-accent-ink",
        tone === "ink" && "bg-ink text-ink-inverse",
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Score bar ───────────────────────────────────────────────────────────────

export function NBScoreBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="h-3.5 w-full border-2 border-edge bg-secondary"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full transition-[width] duration-700 ease-out",
          clamped >= 70 && "bg-primary",
          clamped >= 40 && clamped < 70 && "bg-nb-yellow",
          clamped < 40 && "bg-nb-red",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ── Page shell ──────────────────────────────────────────────────────────────

export function NBPageShell({
  children,
  maxWidth = "max-w-5xl",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="min-h-screen">
      <div className={cn("mx-auto w-full px-4 py-8 sm:px-6", maxWidth)}>
        {children}
      </div>
    </div>
  );
}
