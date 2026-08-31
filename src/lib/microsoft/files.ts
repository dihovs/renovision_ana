import { accessTokenForGraph } from "./auth";

/**
 * Finding a file in the owner's OneDrive. (ANA-07)
 *
 * SEARCHED, NOT SYNCED — the one channel that does not get a table. Files are
 * large, mostly irrelevant to any spoken question, and already have a home;
 * mirroring a drive to answer "did the adjuster send the plan" is the wrong
 * trade. So this asks Graph at question time and returns names, places, dates
 * and people — never contents.
 *
 * NOTHING HERE OPENS A FILE. The tool names what exists ("plan-fleury.pdf, in
 * Documents/Fleury, changed Tuesday by Marie") and stops. Reading a named
 * file's content is a later, deliberate step with its own rules — not a side
 * effect of searching. The same discipline as attachments everywhere else in
 * this codebase: named, never described.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
const MAX_RESULTS = 8;

export type FoundFile = {
  name: string;
  /** The folder path inside the drive, "Documents/Fleury". Empty at the root. */
  folder: string;
  modifiedAt: string | null;
  modifiedBy: string | null;
  /** Bytes; spoken as "2 MB" by the formatter. */
  size: number | null;
  webUrl: string | null;
};

export type FileSearch =
  | { ok: true; files: FoundFile[] }
  | { ok: false; reason: "no_access" | "failed"; detail: string };

type DriveItem = {
  name?: string;
  size?: number;
  webUrl?: string;
  lastModifiedDateTime?: string;
  lastModifiedBy?: { user?: { displayName?: string } };
  parentReference?: { path?: string };
  folder?: unknown;
};

/** "/drive/root:/Documents/Fleury" → "Documents/Fleury". */
export function folderFromPath(path: string | undefined): string {
  if (!path) return "";
  const marker = path.indexOf("root:");
  const raw = marker >= 0 ? path.slice(marker + 5) : path;
  return decodeURIComponent(raw.replace(/^\//, ""));
}

/** One Graph driveItem into the shape the tool speaks. Pure. */
export function mapDriveItem(item: DriveItem): FoundFile | null {
  if (!item.name) return null;
  // Folders match searches too; the owner asks for documents, not directories.
  if (item.folder !== undefined) return null;
  return {
    name: item.name,
    folder: folderFromPath(item.parentReference?.path),
    modifiedAt: item.lastModifiedDateTime ?? null,
    modifiedBy: item.lastModifiedBy?.user?.displayName ?? null,
    size: typeof item.size === "number" ? item.size : null,
    webUrl: item.webUrl ?? null,
  };
}

/**
 * Search the drive by name and content, newest first.
 *
 * Graph's search covers filenames and, for Office documents and PDFs, their
 * indexed text — which is why "Fleury" finds the adjuster's report even when
 * the filename is REPORT-2291.pdf.
 */
export async function searchDriveFiles(query: string): Promise<FileSearch> {
  const auth = await accessTokenForGraph();
  if (!auth.ok) {
    return { ok: false, reason: "no_access", detail: auth.reason };
  }

  const cleaned = query.replace(/['’]/g, "").trim();
  if (!cleaned) return { ok: true, files: [] };

  const url =
    `${GRAPH}/me/drive/root/search(q='${encodeURIComponent(cleaned)}')` +
    `?$top=${MAX_RESULTS * 2}&$select=name,size,webUrl,lastModifiedDateTime,lastModifiedBy,parentReference,folder` +
    `&$orderby=lastModifiedDateTime desc`;

  const response = await fetch(url, { headers: { authorization: `Bearer ${auth.token}` } });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false, reason: "failed", detail: `${response.status}: ${body.slice(0, 200)}` };
  }

  const json = (await response.json()) as { value?: DriveItem[] };
  const files = (json.value ?? [])
    .map(mapDriveItem)
    .filter(Boolean)
    .slice(0, MAX_RESULTS) as FoundFile[];

  return { ok: true, files };
}
