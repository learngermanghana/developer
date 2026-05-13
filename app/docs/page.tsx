import DocsExplorer from "@/components/DocsExplorer";
import { getAllDocs } from "@/lib/docs";

export default function DocsPage() {
  const docs = getAllDocs();

  const publicDocs = docs.map((doc) => ({
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    filePath: doc.filePath,
  }));

  return (
    <div className="space-y-8">
      <section className="section-card p-6 sm:p-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white">Documentation</h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          These pages are rendered directly from your local docs folder, including nested folders.
        </p>
      </section>

      <DocsExplorer docs={publicDocs} />
    </div>
  );
}