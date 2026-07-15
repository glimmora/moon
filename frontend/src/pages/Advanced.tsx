import { useMemo, useState } from "react";
import { useTokens } from "@/hooks/useTokens";
import { TokenCard } from "@/components/tokens/TokenCard";
import { chainMeta } from "@/config/chains";
import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

const TIERS = ["All", "1B", "10B", "100B"] as const;
const CURVES = ["All", "Linear", "Exponential", "Logarithmic"] as const;

export function Advanced() {
  const { data, isLoading } = useTokens();
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<(typeof TIERS)[number]>("All");
  const [curve, setCurve] = useState<(typeof CURVES)[number]>("All");
  const [chainFilter, setChainFilter] = useState<number | "all">("all");

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
    <div className="space-y-4 py-6">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-5 w-5 text-moon-400" />
        <h1 className="text-xl font-bold">Advanced Explorer</h1>
      </div>

      <div className="card p-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or symbol…"
            className="input pl-9"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <FilterGroup label="Supply Tier" options={TIERS as unknown as string[]} value={tier} onChange={(v) => setTier(v as typeof tier)} />
          <FilterGroup label="Curve" options={CURVES as unknown as string[]} value={curve} onChange={(v) => setCurve(v as typeof curve)} />
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Chain</label>
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

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-44 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-neutral-500">No tokens match your filters.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TokenCard key={`${t.chainId}-${t.address}`} token={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-neutral-500">{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              value === o ? "bg-moon-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-neutral-100",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
