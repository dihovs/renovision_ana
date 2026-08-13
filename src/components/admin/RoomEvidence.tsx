"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { tapFeedback } from "@/lib/haptics";
import { updateSavedScan } from "@/lib/roomScan";

/**
 * Photos and notes for one room.
 *
 * The thing that turns a measurement into evidence. A floor plan says the
 * basement is 420 sq ft; a photo of the tide line on the drywall and a note
 * saying "supply line under the sink, failed overnight" is what an adjuster
 * reads. Nine of the twenty pages of the report the client wants to beat are
 * photographs — but theirs are a pile with no room attached, which is why
 * ours are filed against the room from the moment they are taken.
 *
 * Uploads go one at a time and each is reported on its own. A batch that
 * fails halfway with a single error tells the operator nothing about which
 * of their twelve photos actually made it.
 */

export type RoomPhoto = {
  id: string;
  filename: string;
  note: string | null;
  uploaded_at: string;
  content_type: string;
  url: string | null;
};

export default function RoomEvidence({
  roomId,
  initialNotes,
}: {
  roomId: string;
  initialNotes: string | null;
}) {
  const [photos, setPhotos] = useState<RoomPhoto[] | null>(null);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? "");
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/rooms/${encodeURIComponent(roomId)}/photos`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("load"))))
      .then((body: { photos: RoomPhoto[] }) => {
        if (!cancelled) setPhotos(body.photos);
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  async function upload(files: FileList) {
    setError(null);
    for (const file of Array.from(files)) {
      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch(`/api/v1/rooms/${encodeURIComponent(roomId)}/photos`, {
          method: "POST",
          body,
        });
        if (!response.ok) {
          const failed = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(failed?.error ?? "Upload failed.");
        }
      } catch (err) {
        setError(
          `${file.name}: ${err instanceof Error ? err.message : "could not be uploaded."}`,
        );
      } finally {
        setUploading((n) => n - 1);
      }
    }
    // Re-read rather than guessing what the server stored — the signed URL
    // is minted there and cannot be constructed here.
    const response = await fetch(`/api/v1/rooms/${encodeURIComponent(roomId)}/photos`);
    if (response.ok) setPhotos(((await response.json()) as { photos: RoomPhoto[] }).photos);
  }

  async function saveNotes() {
    if (notes === savedNotes) return;
    try {
      await updateSavedScan(roomId, { notes });
      setSavedNotes(notes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the note.");
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-black/5 bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="font-heading text-sm font-bold text-charcoal">Photos &amp; notes</h3>
        {photos !== null && photos.length > 0 && (
          <span className="text-xs font-bold tabular-nums text-charcoal/45">
            {photos.length} photo{photos.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="px-4 pb-3">
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={saveNotes}
          rows={3}
          placeholder="What happened here, and what needs doing. Written on site beats remembered at the desk."
          className="w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
        />
        {notes !== savedNotes && (
          <p className="mt-1 text-[11px] text-charcoal/40">Saves when you tap away.</p>
        )}
      </div>

      {photos === null ? (
        <p className="px-4 pb-3 text-sm text-charcoal/40">Loading…</p>
      ) : photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-1.5 px-4 pb-3">
          {photos.map((photo) => (
            <li key={photo.id} className="overflow-hidden rounded-lg bg-black/[0.04]">
              {photo.url ? (
                <a href={photo.url} target="_blank" rel="noopener noreferrer">
                  <Image
                    src={photo.url}
                    alt={photo.note ?? photo.filename}
                    width={300}
                    height={300}
                    unoptimized
                    className="aspect-square h-auto w-full object-cover"
                  />
                </a>
              ) : (
                <span className="flex aspect-square items-center justify-center p-1 text-center text-[10px] text-charcoal/40">
                  {photo.filename}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {error && (
        <p role="alert" className="px-4 pb-2 text-[11px] font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="border-t border-black/5 p-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          // capture="environment" would force the camera and hide the roll;
          // on site both matter — take one now, or attach one from earlier.
          multiple
          className="hidden"
          onChange={(event) => {
            const files = event.target.files;
            if (files && files.length > 0) void upload(files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={uploading > 0}
          onClick={() => {
            tapFeedback("medium");
            fileInput.current?.click();
          }}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-brand-blue/25 bg-white text-sm font-bold text-brand-blue active:bg-brand-blue/[0.06] disabled:opacity-50"
        >
          {uploading > 0 ? (
            `Uploading ${uploading}…`
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M3 7h3l2-3h8l2 3h3v13H3z" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              Add photos
            </>
          )}
        </button>
      </div>
    </section>
  );
}
