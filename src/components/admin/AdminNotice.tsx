/**
 * The "something is not set up, and here is what to do about it" card.
 *
 * Shared because the alternative — an empty list — reads as "you have no
 * clients" when the truth is "the migration hasn't run", and those two demand
 * completely different reactions from the person looking at the screen.
 */
export default function AdminNotice({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <h2 className="font-heading text-base font-bold text-brand-blue">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-charcoal/70">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
