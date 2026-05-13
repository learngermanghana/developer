import MarkdownRenderer from "@/components/MarkdownRenderer";
import { getDocBySlug } from "@/lib/docs";

const embeddedDocs = [
  "webhook-use-cases-travel-school-events",
  "how-to-use-sedifex",
];

export default function TutorialsPage() {
  const docs = embeddedDocs
    .map((slug) => getDocBySlug(slug))
    .filter((doc) => doc !== null);

  return (
    <div className="space-y-8">
      <section className="section-card p-6 sm:p-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white">Tutorials</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Practical Sedifex walkthroughs pulled directly from your docs folder.
        </p>
      </section>

      {docs.length ? (
        docs.map((doc) => (
          <section key={doc.slug} className="section-card p-6 sm:p-8">
            <div className="mb-8 border-b border-white/10 pb-6">
              <p className="text-sm uppercase tracking-[0.18em] text-cyan-300">Tutorial</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                {doc.title}
              </h2>
              <p className="mt-3 max-w-3xl text-slate-300">{doc.description}</p>
              <div className="mt-4 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                {doc.filePath}
              </div>
            </div>

            <MarkdownRenderer content={doc.content} />
          </section>
        ))
      ) : (
        <section className="section-card p-6 sm:p-8 text-slate-300">
          No tutorial docs were found yet.
        </section>
      )}
    </div>
  );
}