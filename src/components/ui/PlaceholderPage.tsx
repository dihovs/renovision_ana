export default function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8">
      <h1 className="font-heading text-4xl font-extrabold text-brand-blue">{title}</h1>
      <p className="mt-4 text-lg text-charcoal/70">{description}</p>
      <p className="mt-8 inline-block rounded-full bg-brand-blue-light px-4 py-1.5 text-sm font-semibold text-brand-blue">
        Full page coming soon
      </p>
    </section>
  );
}
