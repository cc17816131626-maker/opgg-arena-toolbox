import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { TierListPage } from "./pages/TierListPage";
import { AugmentsPage } from "./pages/AugmentsPage";
import { ChampionDetailPage } from "./pages/ChampionDetailPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tier-list" element={<TierListPage />} />
        <Route path="/augments" element={<AugmentsPage />} />
        <Route path="/champions/:championKey" element={<ChampionDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
