import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTokens } from "@/hooks/useTokens";
import { TokenCard } from "@/components/tokens/TokenCard";
import { chainMeta } from "@/config/chains";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";

const TIERS = ["All", "1B", "10B", "100B"] as const;
const CURVES = ["All", "Linear", "Exponential", "Logarithmic"] as const;

export function Advanced() {
  const { data, isLoading } = useTokens();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [tier, setTier] = useState<(typeof TIERS)[number]>("All");
  const [curve, setCurve] = useState<(typeof CURVES)[number]>("All");
  const [chainFilter, setChainFilter] = useState<number | "all">("all");

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((t) => {
      if (query && !t.name.toLowerCase().includes(query.toLowerCase()) && !t.symbol.toLowerCase().includes(query.toLowerCase()))
        return false;
      if (tier !== "All" && t.supplyTier !== TIERS.indexOf(tier) - 1) return false;
      if (curve !== "All" && t.curveShape !== CURVES.indexOf(curve) - 1) return false;
      if (chainFilter !== "all" && t.chainId !== chainFilter) return false;
      return true;
    });
  }, [data, query, tier, curve, chainFilter]);

  return (
    <div className="space-y-5 py-6 animate-fade-in-up">
      <div className="flex items-center gap-2">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-moon-500/15 border border-moon-500/20">
          <SlidersHorizontal className="h-5 w-5 text-moon-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display">Advanced Explorer</h1>
          <p className="text-xs text-neutral-500">{filtered.length} token{filtered.length === 1 ? "" : "s"} match</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card-elevated p-4 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, symbol, or address…"
            className="input pl-10 pr-10"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer h-52" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Search className="mx-auto mb-3 h-10 w-10 text-neutral-600" />
          <p className="text-sm text-neutral-400">No tokens match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t, i) => (
            <div key={`${t.chainId}-${t.address}`} className="animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
              <TokenCard token={t} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-neutral-400 font-medium">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              value === o
                ? "bg-moon-500/20 text-moon-300 border border-moon-500/30 shadow-glow"
                : "bg-white/[0.04] text-neutral-400 border border-transparent hover:bg-white/[0.06] hover:text-neutral-200",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
