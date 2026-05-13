import Link from "next/link";

export default function NotFound() {
  return (
    <div className="section-card p-10 text-center">
      <h1 className="text-4xl font-semibold text-white">Page not found</h1>
      <p className="mt-3 text-slate-300">The page you requested does not exist yet.</p>
      <div className="mt-6">
        <Link
          href="/"
          className="rounded-full bg-cyan-400 px-5 py-3 font-medium text-slate-950 transition hover:opacity-90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}