const partnerBenefits = [
  "Showcase your Sedifex implementation skills.",
  "Position yourself for referred client work.",
  "Create repeatable offers for local businesses.",
  "Build authority with public documentation and vertical case studies.",
];

export default function PartnersPage() {
  return (
    <div className="space-y-8">
      <section className="section-card p-6 sm:p-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white">Partners</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Sedifex partners can be developers, agencies, or implementation specialists helping businesses launch and grow.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {partnerBenefits.map((item) => (
          <article key={item} className="section-card p-6">
            <h2 className="text-lg font-semibold text-white">{item}</h2>
          </article>
        ))}
      </section>
    </div>
  );
}