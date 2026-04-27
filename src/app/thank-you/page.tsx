import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Logo height={56} />
          <Link
            href="/"
            className="text-sm font-medium text-accent hover:opacity-90"
          >
            Back to Home
          </Link>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl justify-center px-4 py-10 sm:py-12">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="py-16 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-3xl font-semibold text-zinc-900">Thank You!</h1>
            <p className="mx-auto mt-3 max-w-md text-lg text-zinc-600">
              You have successfully submitted your information. We&apos;ll be in touch soon.
            </p>
            <div className="mt-8">
              <Link
                href="/"
                className="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
