"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui";

export function ProtectedRoute({
  requireAdmin = false,
  children,
}: {
  requireAdmin?: boolean;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (requireAdmin && user.role !== "admin") router.replace("/lobby");
  }, [user, loading, requireAdmin, router]);

  if (loading || !user || (requireAdmin && user.role !== "admin")) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-zinc-400">
        <span className="flex items-center gap-3">
          <Spinner /> Loading…
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
