"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PlaceDetails, PlaceSuggestion } from "@/app/api/admin/places/route";

/**
 * Address entry with Google-backed autocomplete on the street line.
 *
 * The suggestion list is a convenience, never a requirement: every field stays
 * editable by hand and the form submits whatever is typed. Quebec addresses
 * Google gets wrong — rural routes, new subdivisions, apartment numbering — are
 * common enough that a picker you cannot override would be worse than no
 * picker at all.
 */

export type AddressValue = {
  street1: string;
  street2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  googlePlaceId?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export const EMPTY_ADDRESS: AddressValue = {
  street1: "",
  street2: "",
  city: "",
  province: "QC",
  postalCode: "",
  country: "Canada",
};

export default function AddressFields({
  value,
  onChange,
  namePrefix,
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  /** Prefixes the input names, so two address blocks can share one form. */
  namePrefix: string;
}) {
  const id = useId();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  // One session token per address being entered. Google bills a session as a
  // unit — keystrokes plus the one details call — so a fresh token per lookup
  // would be charged as many separate sessions.
  //
  // Minted on first use rather than during render: reading and writing a ref
  // while rendering is what `react-hooks/refs` forbids, and it is only ever
  // needed inside a fetch anyway.
  const sessionRef = useRef<string | null>(null);
  function sessionToken(): string {
    sessionRef.current ??= crypto.randomUUID();
    return sessionRef.current;
  }

  // Suppresses the lookup that would otherwise fire when a selection writes
  // the chosen street back into the input.
  const skipNextLookup = useRef(false);

  useEffect(() => {
    if (skipNextLookup.current) {
      skipNextLookup.current = false;
      return;
    }
    const query = value.street1.trim();
    // Nothing to look up, and nothing to clear: `visible` below derives the
    // empty list from the query length, so the effect doesn't have to push it
    // into state and trigger a second render to do it.
    if (query.length < 3) return;

    const controller = new AbortController();
    // 250ms: long enough that a typed street doesn't cost a request per
    // keystroke, short enough that the list feels attached to the typing.
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/places?q=${encodeURIComponent(query)}&session=${sessionToken()}`,
          { signal: controller.signal },
        );
        const body = (await res.json()) as { suggestions?: PlaceSuggestion[]; unavailable?: boolean };
        setUnavailable(Boolean(body.unavailable));
        setSuggestions(body.suggestions ?? []);
        setOpen((body.suggestions ?? []).length > 0);
      } catch {
        // Aborted or offline. Manual entry still works, so this stays silent.
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value.street1]);

  async function choose(suggestion: PlaceSuggestion) {
    setOpen(false);
    skipNextLookup.current = true;
    // Fill the street immediately so the field doesn't sit stale while the
    // details request is in flight.
    onChange({ ...value, street1: suggestion.main });

    try {
      const res = await fetch(
        `/api/admin/places?placeId=${encodeURIComponent(suggestion.placeId)}&session=${sessionToken()}`,
      );
      const details = (await res.json()) as PlaceDetails & { unavailable?: boolean };
      if (details.unavailable || !details.googlePlaceId) return;
      onChange({
        street1: details.street1 || suggestion.main,
        // Keep a manually typed unit number: Google rarely returns one and
        // overwriting it with "" would silently delete the apartment.
        street2: details.street2 || value.street2,
        city: details.city,
        province: details.province || "QC",
        postalCode: details.postalCode,
        country: details.country || "Canada",
        googlePlaceId: details.googlePlaceId,
        latitude: details.latitude,
        longitude: details.longitude,
      });
    } catch {
      // Leave the typed street in place.
    } finally {
      // The session is spent once details are fetched; the next address needs
      // its own token or Google bills the two together and returns stale hits.
      sessionRef.current = null;
    }
  }

  // What the list actually shows. Below the lookup threshold there are no
  // suggestions by definition, whether the last fetch left some behind or not.
  const visible = value.street1.trim().length < 3 ? [] : suggestions;

  function set<K extends keyof AddressValue>(key: K, next: AddressValue[K]) {
    // Any hand-edit invalidates the Google identity of the address — the
    // place_id would otherwise claim a precision the text no longer has.
    const clearsPlace = key !== "street2";
    onChange({
      ...value,
      [key]: next,
      ...(clearsPlace ? { googlePlaceId: undefined, latitude: null, longitude: null } : {}),
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <label htmlFor={`${id}-street1`} className={labelClass}>
          Street address
        </label>
        <input
          id={`${id}-street1`}
          name={`${namePrefix}Street1`}
          value={value.street1}
          onChange={(e) => set("street1", e.target.value)}
          onFocus={() => visible.length > 0 && setOpen(true)}
          // A blur that fires before the click lands would close the list out
          // from under the pointer; the delay lets the selection through.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
          placeholder="1234 Boulevard Saint-Martin Ouest"
          className={inputClass}
        />
        {loading && (
          <span className="absolute right-3 top-[34px] text-[11px] font-medium text-charcoal/35">
            Searching…
          </span>
        )}

        {open && visible.length > 0 && (
          <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow-lg">
            {visible.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(s)}
                  className="block w-full cursor-pointer px-3 py-2 text-left transition-colors hover:bg-black/[0.04]"
                >
                  <span className="block text-sm font-medium text-charcoal">{s.main}</span>
                  {s.secondary && (
                    <span className="block text-xs text-charcoal/50">{s.secondary}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {unavailable && (
          <p className="mt-1 text-[11px] text-charcoal/45">
            Address lookup is unavailable — type the address by hand.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-street2`} className={labelClass}>
            Unit / suite <span className="font-normal text-charcoal/40">optional</span>
          </label>
          <input
            id={`${id}-street2`}
            name={`${namePrefix}Street2`}
            value={value.street2}
            onChange={(e) => set("street2", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-city`} className={labelClass}>
            City
          </label>
          <input
            id={`${id}-city`}
            name={`${namePrefix}City`}
            value={value.city}
            onChange={(e) => set("city", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-province`} className={labelClass}>
            Province
          </label>
          <input
            id={`${id}-province`}
            name={`${namePrefix}Province`}
            value={value.province}
            onChange={(e) => set("province", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-postal`} className={labelClass}>
            Postal code
          </label>
          <input
            id={`${id}-postal`}
            name={`${namePrefix}PostalCode`}
            value={value.postalCode}
            onChange={(e) => set("postalCode", e.target.value.toUpperCase())}
            placeholder="H7T 1A1"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-country`} className={labelClass}>
            Country
          </label>
          <input
            id={`${id}-country`}
            name={`${namePrefix}Country`}
            value={value.country}
            onChange={(e) => set("country", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Carried through the form post so the server stores what Google
          resolved without re-charging for a second lookup. */}
      <input type="hidden" name={`${namePrefix}PlaceId`} value={value.googlePlaceId ?? ""} />
      <input type="hidden" name={`${namePrefix}Latitude`} value={value.latitude ?? ""} />
      <input type="hidden" name={`${namePrefix}Longitude`} value={value.longitude ?? ""} />
    </div>
  );
}

export const labelClass = "mb-1 block text-xs font-semibold text-charcoal/70";
export const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";
