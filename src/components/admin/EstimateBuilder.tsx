"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  EstimateSnapshot,
  SuggestResult,
} from "@/app/(internal)/admin/projects/[id]/estimate/actions";
import { GENERAL_CONDITIONS } from "@/lib/estimator/insurance/derive";
import type { SuggestedLine } from "@/lib/estimator/insurance/suggest";
import { allocateLines, estimateTotals } from "@/lib/estimator/insurance/trailer";
import type { AllocatedLine, EstimateLine, TrailerSettings } from "@/lib/estimator/insurance/types";
import { formatMoney } from "@/lib/crm/money";

/**
 * The estimate builder — three doors, one table.
 *
 *   1. Autofill: "Build from measurements" derives lines from the scans,
 *      affected areas, objects and drying log. Every derived line prints
 *      the figure it came from.
 *   2. AI: describe what's missing, review the proposals, accept the ones
 *      that are right. Accepted lines are manual with `ai` provenance.
 *   3. Manual: search the price book, set a quantity, edit anything.
 *
 * Editing a derived line flips it to manual so the next derivation cannot
 * overwrite the operator's judgement; deleting one leaves a tombstone so it
 * cannot come back.
 */

// Server actions arrive as individual props — the repo's established shape
// for client components driven by the admin (photos page precedent).
type DeriveAction = () => Promise<EstimateSnapshot>;
type SaveAction = (estimateId: string, lines: EstimateLine[]) => Promise<void>;
type SuggestAction = (instruction: string) => Promise<SuggestResult>;
type AcceptAction = (estimateId: string, suggestions: SuggestedLine[]) => Promise<EstimateSnapshot>;
type FinishAction = (roomScanId: string, finish: string) => Promise<EstimateSnapshot>;

const SECTION_ORDER = ["floor", "ceiling", "walls", "trim", "plumbing", "electrical", "misc"];

const FINISH_OPTIONS = [
  { value: "laminate", label: "Laminate" },
  { value: "lvp", label: "Vinyl plank" },
  { value: "engineered", label: "Engineered wood" },
  { value: "hardwood", label: "Hardwood" },
  { value: "carpet", label: "Carpet" },
  { value: "tile", label: "Ceramic tile" },
];

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

type PriceBookHit = {
  id: string;
  item_code: string;
  name: string;
  unit: string;
  unit_price_cents: number;
  category: string;
};

export default function EstimateBuilder({
  projectId,
  initial,
  deriveAction,
  saveAction,
  suggestAction,
  acceptAction,
  finishAction,
}: {
  projectId: string;
  initial: EstimateSnapshot;
  deriveAction: DeriveAction;
  saveAction: SaveAction;
  suggestAction: SuggestAction;
  acceptAction: AcceptAction;
  finishAction: FinishAction;
}) {
  const actions = {
    derive: deriveAction,
    save: saveAction,
    suggest: suggestAction,
    accept: acceptAction,
    setFinish: finishAction,
  };
  const [estimate, setEstimate] = useState(initial);
  const [lines, setLines] = useState<EstimateLine[]>(initial.lines);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);

  const [instruction, setInstruction] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestedLine[]>([]);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  const settings: TrailerSettings = useMemo(
    () => ({
      generalsPct: estimate.generals_bp / 10_000,
      profitPct: estimate.profit_bp / 10_000,
      profitBasis: estimate.profit_basis,
      gstPct: 0.05,
      qstPct: 0.09975,
    }),
    [estimate.generals_bp, estimate.profit_bp, estimate.profit_basis],
  );

  const allocated = useMemo(() => allocateLines(lines, settings), [lines, settings]);
  const totals = useMemo(() => estimateTotals(allocated), [allocated]);
  const removedCount = lines.filter((l) => l.removed).length;
  const unpricedCount = allocated.filter(
    (l) => !l.removed && l.issues.includes("no_item"),
  ).length;

  const run = useCallback(
    async (label: string, task: () => Promise<void>) => {
      setBusy(label);
      setError(null);
      try {
        await task();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const adopt = useCallback((next: EstimateSnapshot) => {
    setEstimate(next);
    setLines(next.lines);
    setDirty(false);
  }, []);

  // Editing a derived line flips it to manual — §3.1's contract, enforced
  // at the only place edits happen.
  const editLine = useCallback((key: string, patch: Partial<EstimateLine>) => {
    setLines((prev) =>
      prev.map((line) =>
        line.key === key ? { ...line, ...patch, origin: "manual" as const } : line,
      ),
    );
    setDirty(true);
  }, []);

  const groups = useMemo(() => {
    const order: string[] = [];
    const byRoom = new Map<string, AllocatedLine[]>();
    for (const line of allocated) {
      if (line.removed && !showRemoved) continue;
      const room = line.roomName || GENERAL_CONDITIONS;
      if (!byRoom.has(room)) {
        byRoom.set(room, []);
        order.push(room);
      }
      byRoom.get(room)!.push(line);
    }
    // General conditions print last, like the reference.
    const rooms = order.filter((r) => r !== GENERAL_CONDITIONS);
    if (byRoom.has(GENERAL_CONDITIONS)) rooms.push(GENERAL_CONDITIONS);
    return rooms.map((room) => {
      const roomLines = byRoom.get(room)!;
      roomLines.sort(
        (a, b) => SECTION_ORDER.indexOf(a.tradeSection) - SECTION_ORDER.indexOf(b.tradeSection),
      );
      const subtotal = roomLines.reduce((s, l) => (l.removed ? s : s + l.totalCents), 0);
      return { room, lines: roomLines, subtotal };
    });
  }, [allocated, showRemoved]);

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {/* The three doors */}
      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              run("derive", async () => {
                adopt(await actions.derive());
              })
            }
            className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-wait disabled:opacity-60"
          >
            {busy === "derive" ? "Deriving…" : "Build from measurements"}
          </button>
          <button
            type="button"
            disabled={busy !== null || !dirty}
            onClick={() =>
              run("save", async () => {
                await actions.save(estimate.id, lines);
                setDirty(false);
              })
            }
            className="cursor-pointer rounded-lg bg-charcoal px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-charcoal/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "save" ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
          <a
            href={`/admin/projects/${projectId}/estimate/print`}
            target="_blank"
            className="cursor-pointer rounded-lg border border-black/10 px-3 py-2 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
          >
            Print preview
          </a>
          {unpricedCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
              {unpricedCount} unpriced line{unpricedCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-snug text-charcoal/50">
          Derived lines cite the measurement they came from. Edit anything — an edited line is
          yours and re-deriving never overwrites it.
        </p>
      </section>

      {/* AI door */}
      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-heading text-sm font-bold text-charcoal">AI assistant</h2>
        <div className="mt-2 flex gap-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && busy === null) {
                e.preventDefault();
                run("suggest", async () => {
                  const result = await actions.suggest(instruction);
                  setSuggestions(result.suggestions);
                  setAiMessage(result.message);
                });
              }
            }}
            placeholder='e.g. "add a 2 ft flood cut in the bathroom" — or leave empty for a full review'
            className={inputClass}
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              run("suggest", async () => {
                const result = await actions.suggest(instruction);
                setSuggestions(result.suggestions);
                setAiMessage(result.message);
              })
            }
            className="shrink-0 cursor-pointer rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark disabled:cursor-wait disabled:opacity-60"
          >
            {busy === "suggest" ? "Thinking…" : "Suggest"}
          </button>
        </div>
        {aiMessage && (
          <p className="mt-2 rounded-lg bg-brand-blue-light px-3 py-2 text-sm text-charcoal/80">
            {aiMessage}
          </p>
        )}
        {suggestions.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-charcoal/40">
                {suggestions.length} proposal{suggestions.length === 1 ? "" : "s"} — nothing is
                added until you accept it
              </span>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  run("accept", async () => {
                    adopt(await actions.accept(estimate.id, suggestions));
                    setSuggestions([]);
                  })
                }
                className="cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
              >
                Accept all
              </button>
            </div>
            <ul className="divide-y divide-black/5 rounded-lg border border-black/10">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-charcoal">
                      {s.name}
                      {s.itemCode && (
                        <span className="ml-2 text-[10px] font-bold uppercase text-charcoal/40">
                          {s.removalItemCode ? `${s.removalItemCode} + ` : ""}
                          {s.itemCode}
                        </span>
                      )}
                      {s.issues.includes("no_item") && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                          unpriced
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-charcoal/50">
                      {s.quantity} {s.unit} · {s.roomName}
                      {s.rationale ? ` — ${s.rationale}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      run("accept", async () => {
                        adopt(await actions.accept(estimate.id, [s]));
                        setSuggestions((prev) => prev.filter((_, j) => j !== i));
                      })
                    }
                    className="shrink-0 cursor-pointer rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-blue/90"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuggestions((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold text-charcoal/60 transition-colors hover:bg-black/[0.03]"
                  >
                    Dismiss
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Manual door */}
      <ManualAdd
        onAdd={(line) => {
          setLines((prev) => [...prev, line]);
          setDirty(true);
        }}
      />

      {/* The document */}
      {groups.length === 0 ? (
        <section className="rounded-xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-charcoal/50">
          Nothing on the estimate yet. Build it from the measurements, ask the AI, or add a line
          by hand.
        </section>
      ) : (
        groups.map((group) => (
          <section
            key={group.room}
            className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="font-heading text-sm font-bold text-charcoal">{group.room}</h2>
              <span className="text-sm font-bold tabular-nums text-charcoal">
                {formatMoney(group.subtotal)}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-black/5 border-t border-black/5">
              {group.lines.map((line) => (
                <LineRow
                  key={line.key}
                  line={line}
                  disabled={busy !== null}
                  onEdit={editLine}
                  onFinish={(roomScanId, finish) =>
                    run("finish", async () => {
                      adopt(await actions.setFinish(roomScanId, finish));
                    })
                  }
                />
              ))}
            </ul>
          </section>
        ))
      )}

      {removedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowRemoved((v) => !v)}
          className="text-xs font-semibold text-charcoal/40 transition-colors hover:text-charcoal"
        >
          {showRemoved ? "Hide" : "Show"} {removedCount} removed line
          {removedCount === 1 ? "" : "s"}
        </button>
      )}

      {/* The Sommaire */}
      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-heading text-sm font-bold text-charcoal">Summary</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <SummaryRow label="Line item total" value={totals.itemsCents} />
          <SummaryRow
            label={`Overhead (${(settings.generalsPct * 100).toFixed(0)}%)`}
            value={totals.generalsCents}
          />
          <SummaryRow
            label={`Profit (${(settings.profitPct * 100).toFixed(0)}%)`}
            value={totals.profitCents}
          />
          <SummaryRow label="TPS (5%)" value={totals.gstCents} />
          <SummaryRow label="TVQ (9.975%)" value={totals.qstCents} />
          <div className="border-t border-black/10 pt-1">
            <SummaryRow label="Replacement value" value={totals.totalCents} bold />
          </div>
          <div className="flex items-baseline justify-between text-xs text-charcoal/50">
            <dt>Estimated crew hours (embedded)</dt>
            <dd className="tabular-nums">{totals.totalLaborHours} h</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={bold ? "font-bold text-charcoal" : "text-charcoal/70"}>{label}</dt>
      <dd className={`tabular-nums ${bold ? "font-bold text-charcoal" : "text-charcoal"}`}>
        {formatMoney(value)}
      </dd>
    </div>
  );
}

function LineRow({
  line,
  disabled,
  onEdit,
  onFinish,
}: {
  line: AllocatedLine;
  disabled: boolean;
  onEdit: (key: string, patch: Partial<EstimateLine>) => void;
  onFinish: (roomScanId: string, finish: string) => void;
}) {
  const unpriced = line.issues.includes("no_item");
  const needsFinish = line.issues.includes("unknown_finish");

  return (
    <li className={`py-2.5 ${line.removed ? "opacity-40" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold text-charcoal ${line.removed ? "line-through" : ""}`}>
            {line.name}
            {line.itemCode || line.removalItemCode ? (
              <span className="ml-2 text-[10px] font-bold uppercase text-charcoal/35">
                {[line.removalItemCode, line.itemCode].filter(Boolean).join(" + ")}
              </span>
            ) : null}
            <ProvenanceChip line={line} />
            {unpriced && !line.removed && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                unpriced
              </span>
            )}
          </div>
          {line.calc && <div className="text-xs text-charcoal/45">{line.calc}</div>}
          {line.note && <div className="text-xs italic text-charcoal/45">{line.note}</div>}
          {needsFinish && line.roomScanId && !line.removed && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-900">
                Floor finish:
              </span>
              {FINISH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onFinish(line.roomScanId!, option.value)}
                  className="cursor-pointer rounded-full border border-black/10 px-2 py-0.5 text-[11px] font-semibold text-charcoal transition-colors hover:border-brand-blue hover:text-brand-blue"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!line.removed && line.activity !== "memo" && (
          <div className="flex shrink-0 items-center gap-1.5">
            <input
              type="number"
              step="0.01"
              min="0"
              value={line.quantity}
              disabled={disabled}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isFinite(value) && value >= 0) {
                  onEdit(line.key, { quantity: Math.round(value * 100) / 100 });
                }
              }}
              className="w-20 rounded-lg border border-black/10 px-2 py-1 text-right text-sm tabular-nums text-charcoal outline-none focus:border-brand-blue"
            />
            <span className="w-14 text-xs text-charcoal/50">{line.unit}</span>
          </div>
        )}

        <div className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-charcoal">
          {line.removed || line.activity === "memo" ? "—" : formatMoney(line.totalCents)}
        </div>

        {line.removed ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onEdit(line.key, { removed: false })}
            className="shrink-0 cursor-pointer text-xs font-bold text-brand-blue hover:underline"
          >
            Restore
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove ${line.name}`}
            onClick={() => onEdit(line.key, { removed: true })}
            className="shrink-0 cursor-pointer text-charcoal/30 transition-colors hover:text-red-600"
          >
            ✕
          </button>
        )}
      </div>
    </li>
  );
}

function ProvenanceChip({ line }: { line: EstimateLine }) {
  if (line.provenance === "ai") {
    return (
      <span className="ml-2 rounded-full bg-brand-green-light px-2 py-0.5 text-[10px] font-bold uppercase text-brand-green-dark">
        AI
      </span>
    );
  }
  if (line.provenance === "rule" && line.origin === "derived") {
    return (
      <span className="ml-2 rounded-full bg-brand-blue/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase text-brand-blue">
        auto
      </span>
    );
  }
  return null;
}

/** The manual door: the quote builder's price book search, feeding the
    estimate's line model. */
function ManualAdd({ onAdd }: { onAdd: (line: EstimateLine) => void }) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<PriceBookHit[]>([]);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((value: string) => {
    setTerm(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.trim().length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch(
          `/api/admin/price-book?q=${encodeURIComponent(value.trim())}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as { items?: PriceBookHit[] };
        setHits(data.items ?? []);
        setOpen(true);
      } catch {
        /* aborted or offline — keep what we have */
      }
    }, 200);
  }, []);

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="font-heading text-sm font-bold text-charcoal">Add a line</h2>
      <div className="relative mt-2">
        <input
          value={term}
          onChange={(e) => search(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search the price book…"
          className={inputClass}
        />
        {open && hits.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-black/10 bg-white shadow-lg">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onAdd({
                      key: `manual:${crypto.randomUUID()}`,
                      origin: "manual",
                      provenance: "operator",
                      roomScanId: null,
                      roomName: GENERAL_CONDITIONS,
                      tradeSection: "misc",
                      activity: "install",
                      itemCode: hit.item_code,
                      removalItemCode: null,
                      name: hit.name,
                      unit: hit.unit,
                      quantity: 1,
                      removeRateCents: null,
                      replaceRateCents: hit.unit_price_cents,
                      calc: "added by hand",
                      note: null,
                      issues: [],
                      taxable: true,
                      removed: false,
                    });
                    setTerm("");
                    setHits([]);
                    setOpen(false);
                  }}
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm text-charcoal transition-colors hover:bg-brand-blue-light"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {hit.name}
                    <span className="ml-2 text-[10px] font-bold uppercase text-charcoal/35">
                      {hit.item_code}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-charcoal/60">
                    {formatMoney(hit.unit_price_cents)} / {hit.unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
