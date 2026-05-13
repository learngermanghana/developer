import Link from "next/link";
import { getAllDocs } from "@/lib/docs";

const featureCards = [
  {
    title: "Build client websites",
    description:
      "Use Sedifex as the backend for salons, schools, restaurants, clinics, churches, and stores.",
  },
  {
    title: "Sell automations",
    description:
      "Package booking sync, bulk email workflows, promo landing pages, and Sheets-based operations.",
  },
  {
    title: "Ship faster with starters",
    description:
      "Turn common verticals into templates you can reuse for multiple paying clients.",
  },
  {
    title: "Join the partner model",
    description:
      "Position developers and agencies as experts businesses can hire for Sedifex setup and delivery.",
  },
];

export default function HomePage() {
  const docs = getAllDocs().slice(0, 8);

  return (
    <div className="space-y-16">
      <section className="section-card overflow-hidden px-6 py-10 sm:px-10">
        <div className="max-w-4xl space-y-6">
          <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1 text-sm font-medium text-cyan-300">
            Sedifex for Developers
          </span>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Build websites, automations, and integrations on Sedifex.
          </h1>

          <p className="max-w-2xl text-lg text-slate-300">
            Turn your docs folder into a real developer portal with guides, code examples, and reusable delivery paths.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/docs"
              className="rounded-full bg-cyan-400 px-5 py-3 font-medium text-slate-950 transition hover:opacity-90"
            >
              Start with docs
            </Link>
            <Link
              href="/starters"
              className="rounded-full border border-white/10 px-5 py-3 font-medium text-white transition hover:bg-white/5"
            >
              View starters
            </Link>
            <Link
              href="/earn"
              className="rounded-full border border-white/10 px-5 py-3 font-medium text-white transition hover:bg-white/5"
            >
              See earning model
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold text-white">What developers can do with this</h2>
          <p className="mt-3 text-slate-300">
            This portal is more than docs. It is a sales tool, onboarding tool, and implementation base.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((item) => (
            <article key={item.title} className="section-card p-6">
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card p-6 sm:p-8">
        <h2 className="text-2xl font-semibold text-white">Core documentation</h2>
        <p className="mt-3 text-slate-300">
          Your existing docs folder becomes the live documentation center.
        </p>

        <div className="mt-6 grid gap-4">
          {docs.map((doc) => (
            <Link
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-cyan-400/40 hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{doc.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{doc.description}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                  {doc.filePath}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}