import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Enid — Free Brand Audit",
  description: "Discover your brand’s hidden potential with Enid by DLB Creative.",
  icons: {
    icon: "/N_Logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} antialiased`}
      >
        <AuthProvider>
        {children}
        <footer className="w-full bg-white border-t border-zinc-200">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-sm text-zinc-600">
            <span>© {new Date().getFullYear()} Enid</span>
            <span className="text-zinc-400">Brand & Website Audit</span>
          </div>
        </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
