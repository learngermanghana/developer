"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type DocItem = {
  slug: string;
  title: string;
};

export default function DocsSidebar({
  docs,
  activeSlug,
}: {
  docs: DocItem[];
  activeSlug: string;
}) {
  const [query, setQuery] = useState("");

  const filteredDocs = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return docs;

    return docs.filter((doc) => doc.title.toLowerCase().includes(value));
  }, [docs, query]);

  return (
    <aside className="section-card h-fit p-5 lg:sticky lg:top-28">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">Docs</p>

      <div className="mt-4">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search docs..."
          className="input-dark"
        />
      </div>

      <div className="mt-4 space-y-2">
        {filteredDocs.length ? (
          filteredDocs.map((item) => {
            const active = item.slug === activeSlug;

            return (
              <Link
                key={item.slug}
                href={`/docs/${item.slug}`}
                className={`block rounded-xl px-3 py-3 text-sm transition ${
                  active
                    ? "bg-cyan-400 text-slate-950"
                    : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04]"
                }`}
              >
                {item.title}
              </Link>
            );
          })
        ) : (
          <div className="rounded-xl border border-white/10 px-3 py-3 text-sm text-slate-400">
            No matching docs.
          </div>
        )}
      </div>
    </aside>
  );
}