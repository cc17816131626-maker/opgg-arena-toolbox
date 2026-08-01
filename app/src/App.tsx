import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";

const HomePage = lazy(() => import("./pages/HomePage").then((m) => ({ default: m.HomePage })));
const TierListPage = lazy(() => import("./pages/TierListPage").then((m) => ({ default: m.TierListPage })));
const AugmentsPage = lazy(() => import("./pages/AugmentsPage").then((m) => ({ default: m.AugmentsPage })));
const ChampionDetailPage = lazy(() =>
  import("./pages/ChampionDetailPage").then((m) => ({ default: m.ChampionDetailPage })),
);
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const ComparePage = lazy(() => import("./pages/ComparePage").then((m) => ({ default: m.ComparePage })));
const ChangelogPage = lazy(() => import("./pages/ChangelogPage").then((m) => ({ default: m.ChangelogPage })));

function PageFallback() {
  return <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">加载中…</div>;
}

function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/tier-list" element={<TierListPage />} />
          <Route path="/augments" element={<AugmentsPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/champions/:championKey" element={<ChampionDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
