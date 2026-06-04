"use client";

import { clsx } from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "glass rounded-2xl border border-white/10 p-5 shadow-xl shadow-black/30",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  className,
  variant = "primary",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "subtle" | "danger";
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-glow-brand hover:brightness-110",
    ghost: "border border-white/15 text-zinc-200 hover:bg-white/5",
    subtle: "bg-white/5 text-zinc-200 hover:bg-white/10",
    danger: "bg-rose-500/90 text-white hover:bg-rose-500",
  };
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
        "active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className,
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-zinc-300">{label}</span>}
      <input
        className={clsx(
          "w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100",
          "outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/30",
          className,
        )}
        {...props}
      />
    </label>
  );
}

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white",
        className,
      )}
    />
  );
}

export function HashChip({ value, label }: { value: string; label?: string }) {
  const copy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(value);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Click to copy"
      className="scrollbar-thin inline-flex max-w-full items-center gap-2 overflow-x-auto rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 font-mono text-xs text-zinc-300 hover:border-white/25"
    >
      {label && <span className="shrink-0 text-zinc-500">{label}:</span>}
      <span className="whitespace-nowrap">{value}</span>
    </button>
  );
}
