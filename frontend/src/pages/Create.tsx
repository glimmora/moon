import { useState } from "react";
import { useAccount } from "wagmi";
import { useCreateToken, type CreateTokenForm } from "@/hooks/useCreateToken";
import { useNetworkMode } from "@/stores/networkMode";
import { chainMeta, MAINNET_CHAIN_IDS, TESTNET_CHAIN_IDS } from "@/config/chains";
import { Rocket, Loader2, AlertCircle, CheckCircle2, Image as ImageIcon, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { Link } from "react-router-dom";

const DEFAULTS: CreateTokenForm = {
  name: "",
  symbol: "",
  imageUrl: "",
  description: "",
  maxTxBps: 100,
  maxHoldBps: 500,
  cooldownSeconds: 60,
  supplyTier: 0,
  curveShape: 0,
};

const TIER_LABELS = ["1B", "10B", "100B"];
const CURVE_LABELS = ["Linear", "Exponential", "Logarithmic"];
const CURVE_DESC = [
  "Gentle slope — good for community tokens",
  "pump.fun style — fast early pumps",
  "Slower start, steeper late — fair launches",
];

export function Create() {
  const { address } = useAccount();
  const { mode } = useNetworkMode();
  const [form, setForm] = useState<CreateTokenForm>(DEFAULTS);
  const [chainId, setChainId] = useState<number>(mode === "mainnet" ? MAINNET_CHAIN_IDS[0] : TESTNET_CHAIN_IDS[0]);
  const { create, pending, error, confirmed } = useCreateToken(chainId);

  const set = <K extends keyof CreateTokenForm>(key: K, value: CreateTokenForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const chainIds = mode === "mainnet" ? MAINNET_CHAIN_IDS : TESTNET_CHAIN_IDS;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create(form);
  }

  return (
    <div className="py-6 animate-fade-in-up">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold font-display tracking-tight">
          Launch a <span className="text-gradient">Token</span>
        </h1>
        <p className="mt-2 text-neutral-400">Deploy in one transaction. No liquidity required.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-3 space-y-6">
          {!address && (
            <div className="card flex items-center gap-2 border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0" /> Connect your wallet to launch a token.
            </div>
          )}

          <form onSubmit={submit} className="card-elevated space-y-5 p-6">
            {/* Basics */}
            <div className="space-y-1.5">
              <h2 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-moon-500/20 text-moon-300 text-xs font-bold">1</span>
                Basics
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Token Name" required>
                <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={32} placeholder="e.g. Doge 2.0" required />
              </Field>
              <Field label="Symbol" required>
                <input className="input uppercase" value={form.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())} maxLength={11} placeholder="DOGE2" required />
              </Field>
            </div>

            <Field label="Image URL">
              <div className="relative">
                <ImageIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input className="input pl-9" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://… or ipfs://" />
              </div>
            </Field>

            <Field label="Description">
              <textarea className="input min-h-24 resize-none" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={280} placeholder="Tell the world about your token…" />
              <p className="mt-1 text-right text-[10px] text-neutral-600 tabular">{form.description.length}/280</p>
            </Field>

            <div className="divider" />

            {/* Economics */}
            <div className="space-y-1.5">
              <h2 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-moon-500/20 text-moon-300 text-xs font-bold">2</span>
                Economics
              </h2>
            </div>

            <Field label="Supply Tier">
              <div className="grid grid-cols-3 gap-2">
                {TIER_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => set("supplyTier", i as 0 | 1 | 2)}
                    className={cn(
                      "rounded-xl border py-3 text-center transition-all",
                      form.supplyTier === i
                        ? "border-moon-500/40 bg-moon-500/10 shadow-glow"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
                    )}
                  >
                    <div className="text-lg font-bold font-display">{label}</div>
                    <div className="text-[10px] text-neutral-500">{["1B supply", "10B supply", "100B supply"][i]}</div>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Curve Shape">
              <div className="grid gap-2">
                {CURVE_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => set("curveShape", i as 0 | 1 | 2)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border p-3 text-left transition-all",
                      form.curveShape === i
                        ? "border-moon-500/40 bg-moon-500/10 shadow-glow"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
                    )}
                  >
                    <div>
                      <div className="text-sm font-semibold">{label}</div>
                      <div className="text-[11px] text-neutral-500">{CURVE_DESC[i]}</div>
                    </div>
                    <CurvePreview shape={i} active={form.curveShape === i} />
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Chain">
              <select className="input" value={chainId} onChange={(e) => setChainId(Number(e.target.value))}>
                {chainIds.map((id) => (
                  <option key={id} value={id}>{chainMeta[id]?.label ?? `Chain ${id}`}</option>
                ))}
              </select>
            </Field>

            <div className="divider" />

            {/* Advanced */}
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-300 list-none">
                <SlidersHorizontal className="h-4 w-4 text-moon-400" />
                Advanced Limits
                <span className="ml-auto text-xs text-neutral-500 group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <div className="mt-4 grid gap-5 sm:grid-cols-3">
                <SliderField label="Max Tx" value={form.maxTxBps} suffix="%" onChange={(v) => set("maxTxBps", v)} min={0} max={500} step={10} />
                <SliderField label="Max Hold" value={form.maxHoldBps} suffix="%" onChange={(v) => set("maxHoldBps", v)} min={0} max={1000} step={50} />
                <SliderField label="Cooldown" value={form.cooldownSeconds} suffix="s" onChange={(v) => set("cooldownSeconds", v)} min={0} max={3600} step={30} />
              </div>
            </details>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-300 animate-fade-in">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}

            {confirmed && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300 animate-fade-in">
                <CheckCircle2 className="h-4 w-4" /> Token created!{" "}
                <Link to="/" className="underline ml-1">View it in the explorer →</Link>
              </div>
            )}

            <button type="submit" disabled={pending || !address} className={cn("btn-primary w-full !py-3 text-base", pending && "opacity-70")}>
              {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
              {pending ? "Launching…" : "Launch Token"}
            </button>
          </form>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-20 space-y-3">
            <p className="text-xs uppercase tracking-wider text-neutral-500 font-medium">Live Preview</p>
            <div className="card-elevated p-5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-moon-gradient opacity-30 blur-md" />
                  <div className="relative h-14 w-14 overflow-hidden rounded-full border border-white/[0.1] bg-ink-900">
                    {form.imageUrl ? (
                      <img src={form.imageUrl} alt="preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-bold text-gradient">
                        {(form.symbol || "??").slice(0, 2)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold truncate font-display">{form.name || "Your Token"}</h3>
                  <p className="text-xs text-neutral-500">${form.symbol || "SYM"}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-neutral-400 line-clamp-3 min-h-[3rem]">
                {form.description || "Token description will appear here…"}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <PreviewStat label="Supply" value={TIER_LABELS[form.supplyTier]} />
                <PreviewStat label="Curve" value={CURVE_LABELS[form.curveShape]} />
                <PreviewStat label="Max Tx" value={`${form.maxTxBps / 100}%`} />
                <PreviewStat label="Max Hold" value={`${form.maxHoldBps / 100}%`} />
              </div>
            </div>

            {/* Fee structure */}
            <div className="card p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider text-neutral-500 font-medium">Fee Distribution</p>
              {[
                { label: "Creator", value: 20, color: "bg-moon-500" },
                { label: "Referrer", value: 10, color: "bg-pink-500" },
                { label: "Dev", value: 28, color: "bg-cyan-500" },
                { label: "Burn", value: 21, color: "bg-amber-500" },
                { label: "Treasury", value: 21, color: "bg-emerald-500" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2 text-xs">
                  <div className={cn("h-2 w-2 rounded-full", row.color)} />
                  <span className="text-neutral-400 flex-1">{row.label}</span>
                  <span className="tabular font-medium">{row.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-neutral-400 font-medium">
        {label} {required && <span className="text-moon-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function SliderField({
  label,
  value,
  suffix,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center justify-between text-xs text-neutral-400">
        <span>{label}</span>
        <span className="tabular font-medium text-neutral-200">
          {value / (suffix === "%" ? 100 : 1)}{suffix}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-moon-500"
      />
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2">
      <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold tabular">{value}</p>
    </div>
  );
}

function CurvePreview({ shape, active }: { shape: number; active: boolean }) {
  const paths = [
    "M 0 30 Q 15 28 30 22 T 60 8", // Linear
    "M 0 30 Q 30 30 60 5", // Exponential
    "M 0 30 Q 20 25 40 18 T 60 10", // Logarithmic
  ];
  return (
    <svg width="60" height="32" className={cn("transition-opacity", active ? "opacity-100" : "opacity-40")}>
      <path d={paths[shape]} fill="none" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
    </svg>
  );
}
