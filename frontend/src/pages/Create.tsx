import { useState } from "react";
import { useAccount } from "wagmi";
import { useCreateToken, type CreateTokenForm } from "@/hooks/useCreateToken";
import { useNetworkMode } from "@/stores/networkMode";
import { chainMeta, MAINNET_CHAIN_IDS, TESTNET_CHAIN_IDS } from "@/config/chains";
import { Rocket, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
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
    <div className="mx-auto max-w-2xl py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Rocket className="h-6 w-6 text-moon-400" />
        <h1 className="text-2xl font-bold">Launch a Token</h1>
      </div>

      {!address && (
        <div className="card flex items-center gap-2 border-yellow-900/50 bg-yellow-950/20 p-4 text-sm text-yellow-300">
          <AlertCircle className="h-4 w-4" /> Connect your wallet to launch a token.
        </div>
      )}

      <form onSubmit={submit} className="card space-y-4 p-6">
        <Field label="Token Name" required>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={32} placeholder="e.g. Doge 2.0" required />
        </Field>

        <Field label="Symbol" required>
          <input className="input" value={form.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())} maxLength={11} placeholder="e.g. DOGE2" required />
        </Field>

        <Field label="Image URL">
          <input className="input" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://… or ipfs://" />
        </Field>

        <Field label="Description">
          <textarea className="input min-h-20" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={280} placeholder="Tell the world about your token…" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Supply Tier">
            <select className="input" value={form.supplyTier} onChange={(e) => set("supplyTier", Number(e.target.value) as 0 | 1 | 2)}>
              <option value={0}>1 Billion</option>
              <option value={1}>10 Billion</option>
              <option value={2}>100 Billion</option>
            </select>
          </Field>
          <Field label="Curve Shape">
            <select className="input" value={form.curveShape} onChange={(e) => set("curveShape", Number(e.target.value) as 0 | 1 | 2)}>
              <option value={0}>Linear</option>
              <option value={1}>Exponential</option>
              <option value={2}>Logarithmic</option>
            </select>
          </Field>
          <Field label="Chain">
            <select className="input" value={chainId} onChange={(e) => setChainId(Number(e.target.value))}>
              {chainIds.map((id) => (
                <option key={id} value={id}>{chainMeta[id]?.label ?? `Chain ${id}`}</option>
              ))}
            </select>
          </Field>
        </div>

        <details className="rounded-lg border border-neutral-800 p-3">
          <summary className="cursor-pointer text-sm font-medium text-neutral-300">Advanced Limits</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Field label={`Max Tx (${form.maxTxBps / 100}%)`}>
              <input type="range" min={0} max={500} step={10} value={form.maxTxBps} onChange={(e) => set("maxTxBps", Number(e.target.value))} className="w-full" />
            </Field>
            <Field label={`Max Hold (${form.maxHoldBps / 100}%)`}>
              <input type="range" min={0} max={1000} step={50} value={form.maxHoldBps} onChange={(e) => set("maxHoldBps", Number(e.target.value))} className="w-full" />
            </Field>
            <Field label={`Cooldown (${form.cooldownSeconds}s)`}>
              <input type="range" min={0} max={3600} step={30} value={form.cooldownSeconds} onChange={(e) => set("cooldownSeconds", Number(e.target.value))} className="w-full" />
            </Field>
          </div>
        </details>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-950/50 p-3 text-xs text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {confirmed && (
          <div className="flex items-center gap-2 rounded-lg bg-green-950/50 p-3 text-xs text-green-300">
            <CheckCircle2 className="h-4 w-4" /> Token created!{" "}
            <Link to="/" className="underline">View it in the explorer →</Link>
          </div>
        )}

        <button type="submit" disabled={pending || !address} className={cn("btn-primary w-full", pending && "opacity-70")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          {pending ? "Launching…" : "Launch Token"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-neutral-500">
        {label} {required && <span className="text-moon-400">*</span>}
      </label>
      {children}
    </div>
  );
}
