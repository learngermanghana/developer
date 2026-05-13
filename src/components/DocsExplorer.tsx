"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type DocItem = {
  slug: string;
  title: string;
  description: string;
  filePath: string;
};

export default function DocsExplorer({ docs }: { docs: DocItem[] }) {
  const [query, setQuery] = useState("");

  const filteredDocs = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return docs;

    return docs.filter((doc) => {
      return (
        doc.title.toLowerCase().includes(value) ||
        doc.description.toLowerCase().includes(value) ||
        doc.filePath.toLowerCase().includes(value)
      );
    });
  }, [docs, query]);

  return (
    <div className="space-y-6">
      <div className="section-card p-4">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search docs, guides, templates..."
          className="input-dark"
        />
      </div>

      <section className="grid gap-5">
        {filteredDocs.length ? (
          filteredDocs.map((doc) => (
            <Link
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              className="section-card p-6 transition hover:border-cyan-400/40 hover:bg-white/[0.04]"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <h2 className="text-2xl font-semibold text-white">{doc.title}</h2>
                  <p className="mt-2 text-slate-300">{doc.description}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                  {doc.filePath}
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className="section-card p-6 text-slate-300">
            No docs match your search.
          </div>
        )}
      </section>
    </div>
  );
}