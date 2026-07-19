import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTokens } from "@/hooks/useTokens";
import { useSearch } from "@/hooks/useSearch";
import { TokenCard } from "@/components/tokens/TokenCard";
import { TokenRow } from "@/components/tokens/TokenRow";
import { chainMeta } from "@/config/chains";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { Pagination } from "@/components/ui/Pagination";
import { useListPrefs } from "@/hooks/useListPrefs";

const TIERS = ["All", "1B", "10B", "100B"] as const;
const CURVES = ["All", "Linear", "Exponential", "Logarithmic"] as const;

export function Advanced() {
  const { data, isLoading, isError, error, refetch } = useTokens();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [tier, setTier] = useState<(typeof TIERS)[number]>("All");
  const [curve, setCurve] = useState<(typeof CURVES)[number]>("All");
  const [chainFilter, setChainFilter] = useState<number | "all">("all");
  const { view, setView, pageSize, setPageSize } = useListPrefs();
  const [page, setPage] = useState(1);
  const { results: backendResults, isSearching, isBackendSearch } = useSearch(query);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setPage(1);
  }, [query, tier, curve, chainFilter, pageSize]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Source list: when the backend search is active, union its results with the
    // loaded tokens (deduped) so matches outside the current page still appear.
    // When the backend is offline or the query is short, fall back to the loaded
    // list and filter client-side.
    const base = data ?? [];
    let source = base;
    if (isBackendSearch) {
      const seen = new Set<string>();
      source = [];
      for (const t of [...backendResults, ...base]) {
        const key = `${t.chainId}-${t.address.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        source.push(t);
      }
    }
    return source.filter((t) => {
      // Match name, symbol, or contract address (address search now works as advertised).
      if (
        q &&
        !t.name.toLowerCase().includes(q) &&
        !t.symbol.toLowerCase().includes(q) &&
        !t.address.toLowerCase().includes(q)
      )
        return false;
      if (tier !== "All" && t.supplyTier !== TIERS.indexOf(tier) - 1) return false;
      if (curve !== "All" && t.curveShape !== CURVES.indexOf(curve) - 1) return false;
      if (chainFilter !== "all" && t.chainId !== chainFilter) return false;
      return true;
    });
  }, [data, backendResults, isBackendSearch, query, tier, curve, chainFilter]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  return (
    <div className="space-y-5 py-6 animate-fade-in-up">
      <div className="flex items-center gap-2">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-moon-500/15 border border-moon-500/20">
          <SlidersHorizontal className="h-5 w-5 text-moon-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-display">Advanced Explorer</h1>
          <p className="text-xs text-neutral-500" aria-live="polite">
            {isLoading ? "Loading…" : isSearching ? "Searching…" : `${filtered.length} token${filtered.length === 1 ? "" : "s"} match`}
          </p>
        </div>
        <ViewToggle value={view} onChange={setView} className="ml-auto" />
      </div>

      {/* Filter bar */}
      <div className="card-elevated p-4 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, symbol, or address…"
            aria-label="Search tokens by name, symbol, or address"
            className="input pl-10 pr-10"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <FilterGroup label="Supply Tier" options={TIERS as unknown as string[]} value={tier} onChange={(v) => setTier(v as typeof tier)} />
          <FilterGroup label="Curve" options={CURVES as unknown as string[]} value={curve} onChange={(v) => setCurve(v as typeof curve)} />
          <div>
            <label className="mb-1.5 block text-xs text-neutral-400 font-medium">Chain</label>
            <select
              value={chainFilter}
              onChange={(e) => setChainFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="input"
            >
              <option value="all">All Chains</option>
              {Object.entries(chainMeta).map(([id, m]) => (
                <option key={id} value={id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading tokens">
          {Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
            <div key={i} className="shimmer h-52" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} title="Couldn't load tokens" onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Search className="mx-auto mb-3 h-10 w-10 text-neutral-600" />
          <p className="text-sm text-neutral-400">No tokens match your filters.</p>
        </div>
      ) : view === "list" ? (
        <>
          <div className="space-y-2">
            {paged.map((t, i) => (
              <div key={`${t.chainId}-${t.address}`} className="animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                <TokenRow token={t} />
              </div>
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paged.map((t, i) => (
              <div key={`${t.chainId}-${t.address}`} className="animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                <TokenCard token={t} />
              </div>
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      )}
    </div>
  );
}

function FilterGroup({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs text-[var(--text-secondary)] font-medium" id={`filter-${label}`}>{label}</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby={`filter-${label}`}>
        {options.map((o) => (
          <button
            key={o}
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(o)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              value === o
                ? "bg-moon-500/20 text-moon-300 border border-moon-500/30 shadow-glow"
                : "bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
