"use client";

import { Logo } from "@/components/Logo";
import { ButtonLink } from "@/components/Button";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/components/AuthProvider";

export default function Home() {
  const { isAdmin, loading } = useAuth();

  return (
    <div className="min-h-screen bg-navy">
      <main className="relative isolate">
        <header className="w-full bg-white">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
            <Logo height={56} />
            <UserMenu />
          </div>
        </header>
        <section className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-none items-start justify-center px-6 pt-16 pb-16 text-center sm:pt-24 sm:pb-24">
          <div className="mx-auto w-full max-w-5xl">
            <h1 className="mx-auto max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-6xl md:text-7xl">
              Discover Your Brand&apos;s{" "}
              <span className="text-accent">Hidden</span> Potential
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-8 text-white/75">
              Benchmark where you are, what&apos;s working, and what to fix first.
              Enid gives you a clear score and roadmap so you can grow with
              confidence.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              {!loading && isAdmin && (
                <ButtonLink href="/dashboard" variant="primary">
                  Admin Dashboard
                </ButtonLink>
              )}
              <ButtonLink href="/brand_input" variant="yellow">
                Run a Free Audit
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
