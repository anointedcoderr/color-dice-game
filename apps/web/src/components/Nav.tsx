"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui";

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={clsx(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition",
        active ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-100",
      )}
    >
      {label}
    </Link>
  );
}

export function Nav() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-bg/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="text-xl">🎲</span>
          <span className="hidden bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent sm:inline">
            Colour Dice Arena
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <NavLink href="/local" label="Quick Play" active={pathname.startsWith("/local")} />
          {user && (
            <>
              <NavLink href="/lobby" label="Lobby" active={pathname.startsWith("/lobby")} />
              <NavLink href="/history" label="History" active={pathname.startsWith("/history")} />
              <NavLink href="/profile" label="Profile" active={pathname.startsWith("/profile")} />
              {user.role === "admin" && (
                <NavLink href="/admin" label="Admin" active={pathname.startsWith("/admin")} />
              )}
            </>
          )}
          <NavLink href="/verify" label="Verify" active={pathname.startsWith("/verify")} />
        </div>

        <div className="flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <span className="hidden text-sm text-zinc-400 sm:inline">{user.username}</span>
              <Button variant="ghost" onClick={logout} className="px-3 py-1.5">
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="px-3 py-1.5">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button className="px-3 py-1.5">Sign up</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
