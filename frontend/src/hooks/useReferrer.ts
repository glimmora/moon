import { useEffect, useState } from "react";
import { isAddress, getAddress, type Address } from "viem";

const STORAGE_KEY = "moon.referrer";
const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * Resolve the active referrer for the current session.
 *
 * On first visit with a `?ref=0x...` query param we persist the referrer to
 * localStorage (first-touch attribution). Subsequent visits reuse the stored
 * value. The on-chain BondingCurve enforces permanent referral links, so this
 * is only a hint — a trader already linked to a referrer keeps that link.
 */
export function useReferrer(): Address | undefined {
  const [referrer, setReferrer] = useState<Address | undefined>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isAddress(stored)) return getAddress(stored);
    } catch {
      /* localStorage unavailable (private mode) — ignore */
    }
    return undefined;
  });

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("ref");
      if (raw && isAddress(raw) && raw.toLowerCase() !== ZERO) {
        const checksummed = getAddress(raw);
        // First-touch: only persist if not already set.
        if (!localStorage.getItem(STORAGE_KEY)) {
          localStorage.setItem(STORAGE_KEY, checksummed);
        }
        setReferrer((prev) => prev ?? checksummed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return referrer;
}
