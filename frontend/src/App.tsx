import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Home } from "@/pages/Home";
import { Advanced } from "@/pages/Advanced";
import { Create } from "@/pages/Create";
import { TokenDetail } from "@/pages/TokenDetail";
import { Claim } from "@/pages/Claim";
import { Referral } from "@/pages/Referral";
import { Watchlist } from "@/pages/Watchlist";
import { NotFound } from "@/pages/NotFound";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/advanced" element={<Advanced />} />
        <Route path="/create" element={<Create />} />
        <Route path="/token/:chainId/:address" element={<TokenDetail />} />
        <Route path="/claim" element={<Claim />} />
        <Route path="/referral" element={<Referral />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
