"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SearchGroup } from "@/app/api/admin/search/route";

/**
 * Global search in the admin header — one box across clients, leads, quotes,
 * jobs and invoices.
 *
 * From sm up it is a visible input that widens on focus; below sm it is an
 * icon that opens a bar over the header, because a permanent input would fight
 * the page title for the only row there is. Results arrive grouped by entity
 * and every row is a real link, so keyboard users can tab through them and
 * Enter on the input jumps straight to the first hit.
 */

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

type SearchResponse = { configured?: boolean; groups?: SearchGroup[] };

export default function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // null while a first answer for the current term is still pending.
  const [groups, setGroups] = useState<SearchGroup[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  // Same pattern as the shell's overlays: any navigation closes and resets the
  // search, so the panel never hangs over the page it just opened.
  useEffect(() => {
    setOpen(false);
    setMobileOpen(false);
    setQuery("");
    setGroups(null);
    setError(null);
  }, [pathname]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_CHARS) {
      setGroups(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const body = (await res.json()) as SearchResponse;
        setNotConfigured(body.configured === false);
        setGroups(body.groups ?? []);
        setLoading(false);
      } catch {
        // An abort means the term moved on — the newer request owns the state.
        if (controller.signal.aborted) return;
        setGroups(null);
        setError("Search isn't responding — try again.");
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const term = query.trim();
  const showPanel = open && term.length >= MIN_CHARS;
  const firstHref = groups?.find((group) => group.results.length > 0)?.results[0]?.href;

  function closeAll() {
    setOpen(false);
    setMobileOpen(false);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeAll();
      event.currentTarget.blur();
    } else if (event.key === "Enter" && firstHref) {
      event.preventDefault();
      closeAll();
      router.push(firstHref);
    }
  }

  return (
    <div className="relative ml-auto flex items-center">
      {/* Desktop: always-visible input that widens on focus. */}
      <div className="relative hidden sm:block">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal/40" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Search clients, quotes, jobs…"
          aria-label="Search the CRM"
          className="w-44 rounded-md border border-black/10 bg-[#f6f8fb] py-1.5 pl-8 pr-8 text-sm text-charcoal outline-none transition-all placeholder:text-charcoal/35 focus:w-64 focus:border-brand-blue/50 focus:bg-white focus:ring-2 focus:ring-brand-blue/15 lg:w-56 lg:focus:w-80"
        />
        {loading && <Spinner className="absolute right-2.5 top-1/2 -translate-y-1/2" />}
      </div>

      {/* Mobile: an icon; the input appears as a bar over the header. */}
      <button
        type="button"
        onClick={() => {
          setMobileOpen(true);
          setOpen(true);
        }}
        aria-label="Search"
        className="flex h-9 w-9 items-center justify-center rounded-md text-charcoal/70 hover:bg-black/[0.04] sm:hidden"
      >
        <SearchIcon />
      </button>

      {mobileOpen && (
        <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-2 border-b border-black/10 bg-white px-4 sm:hidden">
          <SearchIcon className="shrink-0 text-charcoal/40" />
          <input
            // The bar exists because the icon was tapped; focusing it is the
            // whole point of the tap.
            autoFocus
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search clients, quotes, jobs…"
            aria-label="Search the CRM"
            className="min-w-0 flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal/35"
          />
          {loading && <Spinner />}
          <button
            type="button"
            onClick={() => {
              closeAll();
              setQuery("");
            }}
            aria-label="Close search"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-charcoal/70 hover:bg-black/[0.04]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {showPanel && (
        <>
          {/* Full-screen catcher so a click anywhere dismisses the panel —
              same pattern as the shell's create menu. */}
          <button
            type="button"
            aria-label="Close search results"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            onKeyDown={(event) => {
              if (event.key === "Escape") closeAll();
            }}
            className="fixed inset-x-2 top-16 z-50 overflow-hidden rounded-md border border-black/10 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[26rem]"
          >
            <div className="max-h-[min(24rem,70vh)] overflow-y-auto py-1">
              {error ? (
                <p role="alert" className="px-3 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              ) : notConfigured ? (
                <p className="px-3 py-3 text-sm text-charcoal/55">
                  Search needs the database connected — nothing is stored to look through yet.
                </p>
              ) : groups === null ? (
                <p className="flex items-center gap-2 px-3 py-3 text-sm text-charcoal/55">
                  <Spinner /> Searching…
                </p>
              ) : groups.length === 0 ? (
                <p className="px-3 py-3 text-sm text-charcoal/55">
                  No matches for &ldquo;{term}&rdquo;.
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.kind} className="border-b border-black/5 pb-1 last:border-b-0 last:pb-0">
                    <p className="px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wide text-charcoal/40">
                      {group.label}
                    </p>
                    {group.results.map((result, index) => (
                      <Link
                        // Leads all share one href, so the key needs the index.
                        key={`${result.href}-${index}`}
                        href={result.href}
                        onClick={closeAll}
                        className="block px-3 py-1.5 transition-colors hover:bg-black/[0.04] focus:bg-black/[0.04] focus:outline-none"
                      >
                        <span className="block truncate text-sm font-medium text-charcoal">
                          {result.label}
                        </span>
                        {result.detail && (
                          <span className="block truncate text-xs text-charcoal/50">
                            {result.detail}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-charcoal/20 border-t-brand-blue ${className}`}
    />
  );
}
