const models = [
  "Build custom websites for Sedifex merchants.",
  "Charge for setup, migration, and operational automation.",
  "Offer monthly maintenance retainers.",
  "Create and sell reusable starter kits.",
  "Join a partner listing and receive referrals.",
];

export default function EarnPage() {
  return (
    <div className="space-y-8">
      <section className="section-card p-6 sm:p-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white">Earn with Sedifex</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          This developer portal is designed to turn technical knowledge into products, service delivery, and recurring revenue.
        </p>
      </section>

      <section className="section-card p-6 sm:p-8">
        <div className="grid gap-4">
          {models.map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}