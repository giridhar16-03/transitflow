import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

const LandingPage = lazy(() => import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })));
const AuthPage = lazy(() => import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })));
const PublicPage = lazy(() => import("./pages/PublicPage").then((module) => ({ default: module.PublicPage })));
const DriverPage = lazy(() => import("./pages/DriverPage").then((module) => ({ default: module.DriverPage })));
const InstitutionPage = lazy(() => import("./pages/InstitutionPage").then((module) => ({ default: module.InstitutionPage })));
const AdminDebug = lazy(() => import("./pages/AdminDebug").then((module) => ({ default: module.AdminDebug })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage })));

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-background bg-grain text-sm text-muted-foreground">
          Loading TransitFlow...
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/public/:userId?" element={<PublicPage />} />
        <Route path="/driver/:userId?" element={<DriverPage />} />
        <Route path="/institution" element={<InstitutionPage />} />
        <Route path="/admin-debug" element={<AdminDebug />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/tracking" element={<Navigate to="/public" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
