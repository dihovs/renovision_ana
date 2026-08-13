import RoomScanner from "@/components/admin/RoomScanner";

/**
 * Measure a property with the phone's LiDAR scanner.
 *
 * Native-only in practice — the component checks for hardware support and
 * says so plainly in a browser, rather than the nav hiding a page that then
 * 404s.
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
      <RoomScanner />
    </div>
  );
}
