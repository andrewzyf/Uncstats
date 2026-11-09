import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { UserAuditPage } from "./pages/UserAuditPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/u/:username" element={<UserAuditPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
