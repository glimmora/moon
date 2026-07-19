import { useState, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { Copy, Check, Share2, UserPlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/stores/toast";

/**
 * Referral link component. Generates a Moon referral URL tied to the connected
 * wallet and lets the user copy it. The link encodes the referrer address in a query
 * param that the backend resolves into a permanent on-chain referrer link via
 * ReferralRegistry.setReferrer().
 */
export function ReferralLink() {
  const { address } = useAccount();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => { if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);

  const link = address
    ? `${window.location.origin}/?ref=${address}`
    : "Connect wallet to generate your referral link.";

  function markCopied() {
    setCopied(true);
    toast.success("Referral link copied");
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  function copy() {
    if (!address) return;
    try {
      navigator.clipboard.writeText(link).then(markCopied).catch(fallbackCopy);
    } catch {
      fallbackCopy();
    }
  }

  function fallbackCopy() {
    // Fallback for non-secure contexts / clipboard permission denial.
    try {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      markCopied();
    } catch {
      toast.error("Couldn't copy — copy the link manually.");
    }
  }

  async function share() {
    if (!address) return;
    // Prefer the native share sheet on supported devices; fall back to Twitter.
    if (navigator.share) {
      try {
        await navigator.share({ title: "Moon", text: "Launch your meme token on Moon 🌙", url: link });
        return;
      } catch {
        return; // user cancelled — no error toast
      }
    }
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent("Launch your meme token on Moon 🌙")}&url=${encodeURIComponent(link)}`,
      "_blank",
      "noreferrer",
    );
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-moon-400" />
        <h3 className="font-semibold">Your Referral Link</h3>
      </div>
      <p className="text-sm text-neutral-500">
        Earn <span className="text-moon-300">10%</span> of the trade fee on every trade made by a
        trader you refer — permanently.
      </p>

      <div className="flex items-center gap-2">
        <input
          readOnly
          value={link}
          className="input flex-1 font-mono text-xs"
          aria-label="Referral link"
        />
        <button
          onClick={copy}
          disabled={!address}
          className={cn("btn-ghost", !address && "opacity-50")}
          aria-label="Copy referral link"
        >
          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={share}
          disabled={!address}
          className={cn("btn-outline flex-1 text-xs", !address && "opacity-50")}
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>

      {!address && (
        <p className="text-center text-xs text-neutral-600">
          Connect your wallet to generate a referral link.
        </p>
      )}
    </div>
  );
}
