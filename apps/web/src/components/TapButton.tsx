"use client";

export function TapButton({
  disabled,
  onTap,
  label,
}: {
  disabled: boolean;
  onTap: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onTap}
      disabled={disabled}
      className="rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-12 py-5 text-xl font-extrabold text-white shadow-[0_0_45px_rgba(168,85,247,0.55)] transition active:scale-95 disabled:cursor-not-allowed disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-50 disabled:shadow-none"
    >
      {label ?? "Tap to Play"}
    </button>
  );
}
