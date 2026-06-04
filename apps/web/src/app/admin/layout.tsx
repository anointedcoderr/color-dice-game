"use client";

import type { ReactNode } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <ProtectedRoute requireAdmin>{children}</ProtectedRoute>;
}
