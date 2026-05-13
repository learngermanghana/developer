import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DocsSidebar from "@/components/DocsSidebar";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { getAllDocs, getDocBySlug } from "@/lib/docs";

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

export function generateStaticParams() {
  return getAllDocs().map((doc) => ({
    slug: doc.slug.split("/"),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);

  if (!doc) {
    return {
      title: "Document not found",
    };
  }

  return {
    title: doc.title,
    description: doc.description,
  };
}

export default async function DocDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);

  if (!doc) {
    notFound();
  }

  const allDocs = getAllDocs().map((item) => ({
    slug: item.slug,
    title: item.title,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <DocsSidebar docs={allDocs} activeSlug={doc.slug} />

      <article className="section-card p-6 sm:p-8">
        <div className="mb-8 border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-300">Sedifex Docs</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">{doc.title}</h1>
          <p className="mt-3 max-w-3xl text-slate-300">{doc.description}</p>
          <div className="mt-4 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
            {doc.filePath}
          </div>
        </div>

        <MarkdownRenderer content={doc.content} />
      </article>
    </div>
  );
}