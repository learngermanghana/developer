const starters = [
  {
    title: "Beauty business starter",
    description:
      "For salons, med spas, makeup studios, and service-led brands that need bookings and promo pages.",
  },
  {
    title: "School / academy starter",
    description:
      "For schools and training centers that need course pages, lead capture, and operational workflows.",
  },
  {
    title: "Restaurant starter",
    description:
      "For food businesses that need menus, promos, product visuals, and future order-ready expansion.",
  },
  {
    title: "Church / ministry starter",
    description:
      "For churches that want events, products, donations, visibility, and member communication workflows.",
  },
];

export default function StartersPage() {
  return (
    <div className="space-y-8">
      <section className="section-card p-6 sm:p-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white">Starters</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Reusable vertical templates help developers deliver faster and earn from packaged Sedifex solutions.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {starters.map((item) => (
          <article key={item.title} className="section-card p-6">
            <h2 className="text-xl font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}