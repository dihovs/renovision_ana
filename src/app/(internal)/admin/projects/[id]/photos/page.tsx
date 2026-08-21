import { notFound } from "next/navigation";
import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import SendPhotosPicker from "@/components/admin/SendPhotosPicker";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import { getProject, listAllProjectPhotos, signProjectFileUrls } from "@/lib/crm/projects";
import { getClient } from "@/lib/crm/clients";
import { emailPhotosAction } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * Pick photos already on the job and email them to the customer.
 *
 * The owner chose email over MMS for this (`Docs/CRM-Messaging.md` §3) —
 * cost was never the reason, deliverability and "no new channel to check"
 * were. So this reuses the photos already captured on site rather than
 * asking anybody to re-upload or re-select from their phone.
 */
export default async function SendPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  const project = await getProject(id).catch((err) => {
    if (err instanceof MigrationPendingError) return null;
    throw err;
  });
  if (!project) notFound();

  const client = project.client ? await getClient(project.client.id).catch(() => null) : null;

  const photos = await listAllProjectPhotos(project.id).catch(() => []);
  const urls = await signProjectFileUrls(photos.map((photo) => photo.storage_path));

  const pickable = photos.map((photo) => ({
    id: photo.id,
    path: photo.storage_path,
    filename: photo.filename,
    roomName: photo.roomName,
    url: urls[photo.storage_path] ?? null,
  }));

  const recipientOptions = (client?.emails ?? [])
    .filter((entry) => entry.address?.trim())
    .map((entry) => entry.address.trim());

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div>
        <Link
          href={`/admin/projects/${project.id}`}
          className="text-xs font-bold text-charcoal/45 transition-colors hover:text-charcoal"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 font-heading text-lg font-bold text-charcoal">Email photos</h1>
        <p className="mt-0.5 text-sm text-charcoal/50">
          Pick from what has already been captured on this job — nothing is re-uploaded.
        </p>
      </div>

      {!project.client && (
        <AdminNotice title="This project has no client">
          Attach a client to the project before photos can be addressed to anybody.
        </AdminNotice>
      )}

      {project.client && photos.length === 0 && (
        <AdminNotice title="No photos on this job yet">
          Room photos and files with an image type will show up here once they are captured.
        </AdminNotice>
      )}

      {project.client && photos.length > 0 && (
        <SendPhotosPicker
          projectId={project.id}
          photos={pickable}
          recipientOptions={recipientOptions}
          sendAction={emailPhotosAction}
        />
      )}
    </div>
  );
}
