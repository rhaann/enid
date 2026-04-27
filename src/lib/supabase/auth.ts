import { createClient } from "./server";

export type AuthResult = {
  user: { id: string; email: string };
  isAdmin: boolean;
};

export async function getAuthUser(): Promise<AuthResult | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user: { id: user.id, email: user.email ?? "" },
    isAdmin: profile?.tier === "admin",
  };
}

export async function requireAdmin(): Promise<AuthResult | null> {
  const auth = await getAuthUser();
  if (!auth || !auth.isAdmin) return null;
  return auth;
}
