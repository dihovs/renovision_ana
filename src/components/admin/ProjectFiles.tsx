"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

/**
 * The project's file library: upload, list, download, delete.
 *
 * Uploads go ONE FILE PER REQUEST to the project's upload route, because the
 * platform caps a request body around 4.5 MB — batching would make the
 * largest photo sink the whole batch, while one-per-request means a failure
 * costs exactly one file and the error says which. Downloads are short-lived
 * signed URLs minted by the server page on each render; a missing URL means
 * signing failed, and the row renders unlinked rather than broken.
 */

export type ProjectFileRow = {
  id: string;
  filename: string;
  size_bytes: number;
  content_type: string;
  note: string | null;
  uploaded_at: string;
  /** Signed URL for this render, or null when signing failed. */
  url: string | null;
};

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 100 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  });
}

export default function ProjectFiles({
  projectId,
  files,
  maxBytes,
  deleteAction,
}: {
  projectId: string;
  files: ProjectFileRow[];
  maxBytes: number;
  deleteAction: (fileId: string) => Promise<void>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  // Native only: a plain file input can pick an existing photo but, without
  // an image `accept`, iOS never offers the camera itself. The plugin call
  // also compresses on the way out of the camera, which matters here — a
  // phone's raw photo routinely exceeds the platform's ~4.5 MB request cap
  // this page already guards against.
  async function takePhoto() {
    if (uploading) return;
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 80,
      });
      if (!photo.webPath) return;
      const blob = await (await fetch(photo.webPath)).blob();
      const file = new File([blob], `photo-${Date.now()}.jpg`, {
        type: blob.type || "image/jpeg",
      });
      setSelected((current) => [...current, file]);
    } catch {
      // Cancelled from the native picker, or camera permission denied —
      // either way there is nothing to upload, so this stays silent rather
      // than reporting an "upload" error for a photo that was never taken.
    }
  }

  async function upload() {
    if (selected.length === 0 || uploading) return;
    setUploading(true);
    setErrors([]);
    const failures: string[] = [];

    for (const [i, file] of selected.entries()) {
      setProgress(`Uploading ${i + 1} of ${selected.length} — ${file.name}`);
      // Checked here too so an oversized file fails instantly instead of
      // after a full upload; the server re-measures and is the authority.
      if (file.size > maxBytes) {
        failures.push(`${file.name}: over the ${formatBytes(maxBytes)} limit`);
        continue;
      }
      try {
        const body = new FormData();
        body.append("file", file);
        if (note.trim()) body.append("note", note.trim());
        const res = await fetch(`/admin/projects/${projectId}/files`, {
          method: "POST",
          body,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          failures.push(`${file.name}: ${data?.error ?? `upload failed (${res.status})`}`);
        }
      } catch {
        failures.push(`${file.name}: network error — check the connection and retry`);
      }
    }

    setProgress(null);
    setUploading(false);
    setErrors(failures);
    // Anything that landed should appear even if a sibling failed.
    if (failures.length < selected.length) router.refresh();
    if (failures.length === 0) {
      setSelected([]);
      setNote("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="font-heading text-sm font-bold text-charcoal">Files</h2>
      <p className="mt-0.5 text-xs text-charcoal/50">
        Site photos, permits, contracts, receipts, plans — everything for this project in one
        place. Up to {formatBytes(maxBytes)} per file.
      </p>

      {/* Upload ------------------------------------------------------- */}
      <div className="mt-3 rounded-lg border border-dashed border-black/15 bg-black/[0.015] p-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            disabled={uploading}
            aria-label="Choose files to upload"
            onChange={(event) => setSelected(Array.from(event.target.files ?? []))}
            className="min-w-0 flex-1 cursor-pointer text-sm text-charcoal/70 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-blue/[0.08] file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-brand-blue hover:file:bg-brand-blue/[0.14]"
          />
          {Capacitor.isNativePlatform() && (
            <button
              type="button"
              onClick={takePhoto}
              disabled={uploading}
              className="shrink-0 cursor-pointer rounded-lg border border-brand-blue/30 bg-white px-3 py-1.5 text-sm font-bold text-brand-blue transition-colors hover:bg-brand-blue/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Take Photo
            </button>
          )}
          <button
            type="button"
            onClick={upload}
            disabled={uploading || selected.length === 0}
            className="cursor-pointer rounded-lg bg-brand-blue px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? "Uploading…"
              : selected.length > 1
                ? `Upload ${selected.length} files`
                : "Upload"}
          </button>
        </div>
        <input
          type="text"
          value={note}
          maxLength={500}
          disabled={uploading}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note — e.g. “signed permit” (applies to this batch)"
          className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
        />
        {progress && (
          <p className="mt-2 text-xs font-semibold text-brand-blue" aria-live="polite">
            {progress}
          </p>
        )}
        {errors.length > 0 && (
          <ul role="alert" className="mt-2 space-y-0.5 text-xs font-medium text-red-700">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </div>

      {/* List --------------------------------------------------------- */}
      {files.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal/40">
          Nothing here yet. Photos taken on site, the permit, the signed contract — drop them in
          as they appear and they stay findable.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-black/5">
          {files.map((file) => (
            <FileRow key={file.id} file={file} deleteAction={deleteAction} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FileRow({
  file,
  deleteAction,
}: {
  file: ProjectFileRow;
  deleteAction: (fileId: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteAction(file.id);
        // The action revalidates the page; the row disappears on re-render.
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete the file.");
        setConfirming(false);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        {file.url ? (
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            title={file.filename}
            className="block truncate text-sm font-semibold text-brand-blue hover:underline"
          >
            {file.filename}
          </a>
        ) : (
          <span
            title={`${file.filename} — download link unavailable, reload the page`}
            className="block truncate text-sm font-semibold text-charcoal/60"
          >
            {file.filename}
          </span>
        )}
        <span className="block truncate text-xs text-charcoal/50">
          {formatBytes(file.size_bytes)} · {formatDate(file.uploaded_at)}
          {file.note ? ` · ${file.note}` : ""}
        </span>
        {error && (
          <span role="alert" className="block text-xs font-medium text-red-700">
            {error}
          </span>
        )}
      </div>

      {confirming ? (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="cursor-pointer rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-charcoal/50 transition-colors hover:text-charcoal disabled:opacity-50"
          >
            Keep
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-charcoal/35 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          Delete
        </button>
      )}
    </li>
  );
}
