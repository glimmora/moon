import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Home } from "@/pages/Home";
import { NotFound } from "@/pages/NotFound";

const Advanced = lazy(() => import("@/pages/Advanced").then((m) => ({ default: m.Advanced })));
const Create = lazy(() => import("@/pages/Create").then((m) => ({ default: m.Create })));
const TokenDetail = lazy(() => import("@/pages/TokenDetail").then((m) => ({ default: m.TokenDetail })));
const Claim = lazy(() => import("@/pages/Claim").then((m) => ({ default: m.Claim })));
const Referral = lazy(() => import("@/pages/Referral").then((m) => ({ default: m.Referral })));
const Watchlist = lazy(() => import("@/pages/Watchlist").then((m) => ({ default: m.Watchlist })));
const Portfolio = lazy(() => import("@/pages/Portfolio").then((m) => ({ default: m.Portfolio })));
const Leaderboard = lazy(() => import("@/pages/Leaderboard").then((m) => ({ default: m.Leaderboard })));

function LazyPage({ element }: { element: React.ReactElement }) {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="h-8 w-8 rounded-full border-2 border-moon-500/30 border-t-moon-500 animate-spin" /></div>}>{element}</Suspense>;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/advanced" element={<LazyPage element={<Advanced />} />} />
        <Route path="/create" element={<LazyPage element={<Create />} />} />
        <Route path="/token/:chainId/:address" element={<LazyPage element={<TokenDetail />} />} />
        <Route path="/portfolio" element={<LazyPage element={<Portfolio />} />} />
        <Route path="/portfolio/:address" element={<LazyPage element={<Portfolio />} />} />
        <Route path="/leaderboard" element={<LazyPage element={<Leaderboard />} />} />
        <Route path="/claim" element={<LazyPage element={<Claim />} />} />
        <Route path="/referral" element={<LazyPage element={<Referral />} />} />
        <Route path="/watchlist" element={<LazyPage element={<Watchlist />} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
