import { archiveItemAction, createItemAction, seedAction, updateItemAction } from "./actions";
import AdminNotice from "@/components/admin/AdminNotice";
import PriceBookManager from "@/components/admin/PriceBookManager";
import { MigrationPendingError, isConfigured } from "@/lib/crm/db";
import { countPriceBook, listCategories, listPriceBook } from "@/lib/crm/priceBook";
import type { PriceBookItem } from "@/lib/crm/quoteTypes";

export const dynamic = "force-dynamic";

export default async function PriceBookPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() ?? "";

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set <code className="font-mono text-brand-blue">SUPABASE_URL</code> and{" "}
        <code className="font-mono text-brand-blue">SUPABASE_SERVICE_ROLE_KEY</code> to turn this
        on.
      </AdminNotice>
    );
  }

  let items: PriceBookItem[] = [];
  let categories: string[] = [];
  let total = 0;
  try {
    [items, categories, total] = await Promise.all([
      listPriceBook({ search }),
      listCategories(),
      countPriceBook(),
    ]);
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Open the Supabase SQL editor and run{" "}
          <code className="font-mono text-brand-blue">supabase/migrations/0006_quoting.sql</code>.
          This screen fills itself in as soon as the tables exist.
        </AdminNotice>
      );
    }
    return (
      <AdminNotice title="Could not reach the database">
        {err instanceof Error ? err.message : "Unknown error"}.
      </AdminNotice>
    );
  }

  return (
    <PriceBookManager
      items={items}
      categories={categories}
      totalCount={total}
      createAction={createItemAction}
      updateAction={updateItemAction}
      archiveAction={archiveItemAction}
      seedAction={seedAction}
    />
  );
}
