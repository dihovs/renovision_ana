import { guarded } from "../../guard";
import { getQuote } from "@/lib/crm/quotes";

/** One quote with its lines — including the `tier` on each, so a native
    screen can render Good/Better/Best the same way the public page does. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(async () => {
    const quote = await getQuote(id);
    if (!quote) return { error: "That quote no longer exists." };
    return { quote };
  });
}
