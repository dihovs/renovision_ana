import { guarded } from "../../guard";
import { deleteMoistureReading } from "@/lib/crm/dryingLog";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(async () => {
    await deleteMoistureReading(id);
    return { ok: true };
  });
}
