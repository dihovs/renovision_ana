import ScanStart from "@/components/admin/ScanStart";

/**
 * Start measuring a property.
 *
 * This used to BE the scanner — it captured rooms that belonged to no
 * project, held them in memory, and lost them on reload. Now it asks which
 * property and which storey and hands off to the floor workspace, so there
 * is one capture path in the app and no way to measure a room into nowhere.
 */
export const metadata = { robots: { index: false, follow: false } };

export default function ScanPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-charcoal">Scan</h1>
        <p className="mt-0.5 text-sm text-charcoal/50">
          Measure rooms with the phone instead of a tape.
        </p>
      </div>
      <ScanStart />
    </div>
  );
}
