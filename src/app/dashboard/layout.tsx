import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/auth";
import type { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/");
  }

  return <>{children}</>;
}
