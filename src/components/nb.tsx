import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Neobrutalism Minimalism kit.
 * Square corners, 2px ink borders, flat color blocks, hard offset shadows.
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
    <Tag
      className={cn(
        "nb-block nb-shadow bg-card text-card-foreground",
        className,
      )}
    >
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
        "inline-flex items-center justify-center gap-2 border-2 border-ink font-bold uppercase tracking-wide",
        "transition-[transform,box-shadow] duration-100 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        // pressable: hover lifts, active presses into the shadow
        "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--ink)]",
        "active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
        // sizes
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-5 text-sm",
        size === "lg" && "h-12 px-7 text-base",
        // variants (flat blocks)
        variant === "primary" && "nb-shadow bg-primary text-ink",
        variant === "ink" && "nb-shadow bg-ink text-background",
        variant === "outline" && "nb-shadow bg-card text-ink",
        variant === "danger" &&
          "nb-shadow bg-destructive text-white [text-shadow:0_1px_0_rgba(0,0,0,0.2)]",
        variant === "ghost" && "bg-transparent text-ink shadow-none",
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
        "h-11 w-full border-2 border-ink bg-card px-3 py-2 text-sm font-medium text-ink",
        "placeholder:font-normal placeholder:text-muted-foreground",
        "outline-none transition-shadow",
        "focus:shadow-[3px_3px_0_0_var(--ink)]",
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
        "mb-1.5 block text-xs font-bold uppercase tracking-widest text-ink",
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
  tone?: "paper" | "yellow" | "green" | "blue" | "red" | "purple" | "ink";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border-2 border-ink px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        tone === "paper" && "bg-card text-ink",
        tone === "yellow" && "bg-primary text-ink",
        tone === "green" && "bg-nb-green text-ink",
        tone === "blue" && "bg-nb-blue text-ink",
        tone === "red" && "bg-destructive text-white",
        tone === "purple" && "bg-nb-purple text-ink",
        tone === "ink" && "bg-ink text-background",
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
      className="h-3.5 w-full border-2 border-ink bg-card"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full transition-[width] duration-700 ease-out",
          clamped >= 70 && "bg-nb-green",
          clamped >= 40 && clamped < 70 && "bg-primary",
          clamped < 40 && "bg-destructive",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ── Page shell for authenticated pages ──────────────────────────────────────

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
