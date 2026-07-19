import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "id";

const STORAGE_KEY = "Moon.locale";

/**
 * Translation dictionaries. English is the source of truth; every key must exist
 * in `en`. Indonesian (`id`) may omit keys — missing keys fall back to English.
 * Values may contain `{name}`-style placeholders interpolated by `t()`.
 */
const en = {
  "nav.discover": "Discover",
  "nav.advanced": "Advanced",
  "nav.watchlist": "Watchlist",
  "nav.leaderboard": "Leaderboard",
  "nav.portfolio": "Portfolio",
  "nav.referral": "Referral",
  "nav.create": "Create",
  "nav.launch": "Launch",

  "common.search": "Search",
  "common.searchPlaceholder": "Search by name, symbol, or address…",
  "common.retry": "Retry",
  "common.loading": "Loading…",
  "common.connectWallet": "Connect Wallet",
  "common.viewAll": "View all",
  "common.language": "Language",

  "portfolio.title": "Portfolio",
  "portfolio.value": "Portfolio Value",
  "portfolio.unrealizedPnl": "Unrealized PnL",
  "portfolio.totalTrades": "Total Trades",
  "portfolio.tokensCreated": "Tokens Created",
  "portfolio.topPositions": "Top Positions",
  "portfolio.noPositions": "No active positions.",

  "referral.title": "Referral Program",
  "referral.subtitle": "Earn 10% of every trade fee from traders you refer — permanently.",
  "referral.referrals": "Referrals",
  "referral.totalVolume": "Total Volume",
  "referral.rewardsEarned": "Rewards Earned",
  "referral.linkOnChain": "Link referrer",
  "referral.linking": "Linking…",
  "referral.linked": "Your referrer is linked on-chain.",

  "chart.price": "Price",
  "chart.areaChart": "Area chart",
  "chart.candlestickChart": "Candlestick chart",
  "chart.noTrades": "No trades yet",
} as const;

export type TranslationKey = keyof typeof en;

const id: Partial<Record<TranslationKey, string>> = {
  "nav.discover": "Jelajahi",
  "nav.advanced": "Lanjutan",
  "nav.watchlist": "Pantauan",
  "nav.leaderboard": "Peringkat",
  "nav.portfolio": "Portofolio",
  "nav.referral": "Referal",
  "nav.create": "Buat",
  "nav.launch": "Luncurkan",

  "common.search": "Cari",
  "common.searchPlaceholder": "Cari berdasarkan nama, simbol, atau alamat…",
  "common.retry": "Coba lagi",
  "common.loading": "Memuat…",
  "common.connectWallet": "Hubungkan Dompet",
  "common.viewAll": "Lihat semua",
  "common.language": "Bahasa",

  "portfolio.title": "Portofolio",
  "portfolio.value": "Nilai Portofolio",
  "portfolio.unrealizedPnl": "PnL Belum Terealisasi",
  "portfolio.totalTrades": "Total Transaksi",
  "portfolio.tokensCreated": "Token Dibuat",
  "portfolio.topPositions": "Posisi Teratas",
  "portfolio.noPositions": "Tidak ada posisi aktif.",

  "referral.title": "Program Referal",
  "referral.subtitle": "Dapatkan 10% dari setiap biaya transaksi trader yang Anda ajak — selamanya.",
  "referral.referrals": "Referal",
  "referral.totalVolume": "Total Volume",
  "referral.rewardsEarned": "Hadiah Diperoleh",
  "referral.linkOnChain": "Tautkan perujuk",
  "referral.linking": "Menautkan…",
  "referral.linked": "Perujuk Anda tertaut di on-chain.",

  "chart.price": "Harga",
  "chart.areaChart": "Grafik area",
  "chart.candlestickChart": "Grafik candlestick",
  "chart.noTrades": "Belum ada transaksi",
};

const DICTIONARIES: Record<Locale, Partial<Record<TranslationKey, string>>> = { en, id };

// eslint-disable-next-line react-refresh/only-export-components
export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "id", label: "Bahasa Indonesia" },
];

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "id") return saved;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("id")) return "id";
  return "en";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const value = useMemo<I18nContextValue>(() => {
    const setLocale = (l: Locale) => {
      setLocaleState(l);
      try {
        window.localStorage.setItem(STORAGE_KEY, l);
      } catch {
        /* ignore */
      }
    };
    const t = (key: TranslationKey, vars?: Record<string, string | number>) => {
      const dict = DICTIONARIES[locale];
      let str = dict[key] ?? en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return str;
    };
    return { locale, setLocale, t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useT() {
  return useI18n().t;
}
