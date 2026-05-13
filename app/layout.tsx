import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sedifex Developers",
    template: "%s | Sedifex Developers",
  },
  description:
    "Build websites, integrations, automations, and developer solutions on Sedifex.",
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/docs", label: "Docs" },
  { href: "/tutorials", label: "Tutorials" },
  { href: "/starters", label: "Starters" },
  { href: "/earn", label: "Earn" },
  { href: "/partners", label: "Partners" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const year = new Date().getFullYear();

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
          <header className="sticky top-0 z-50 mt-4 border border-white/10 bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/70">
            <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Link href="/" className="text-xl font-semibold tracking-tight text-white">
                  Sedifex Developers
                </Link>
                <p className="mt-1 text-sm text-slate-300">
                  Build websites, automations, and integrations that pay.
                </p>
              </div>

              <nav className="flex flex-wrap gap-3 text-sm text-slate-200">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-white/10 px-4 py-2 transition hover:border-cyan-400/40 hover:bg-white/5"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="flex-1 py-10">{children}</main>

          <footer className="border-t border-white/10 py-8 text-sm text-slate-400">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <p className="text-base font-semibold text-white">Sedifex Developers</p>
                <p>Build websites, automations, and integrations with Sedifex.</p>
                <p>© {year} Sedifex. All rights reserved.</p>
              </div>

              <div className="space-y-2 text-slate-300">
                <p>
                  Website:{" "}
                  <a
                    href="https://www.sedifex.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-300 hover:underline"
                  >
                    www.sedifex.com
                  </a>
                </p>
                <p>
                  Email:{" "}
                  <a
                    href="mailto:info@sedifex.com"
                    className="text-cyan-300 hover:underline"
                  >
                    info@sedifex.com
                  </a>
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}