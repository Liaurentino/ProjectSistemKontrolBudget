import { Routes, Route, NavLink, Navigate } from "react-router-dom";

import { BudgetPage } from "./pages/BudgetPage";
import { RealisasiPage } from "./pages/RealisasiPage";
import { AccurateSync } from "./pages/SettingsPage";
import { LoginPage } from "./pages/LoginPage";
import { ComparisonPage } from "./pages/DashboardPage";
import { EntitasPage } from "./pages/EntitasPage";

import { useAuth } from "./contexts/AuthContext";

export default function App() {
  const { user, loading, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="app-loading">
        Loading...
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Navbar */}
      <nav className="app-navbar">
        <div className="app-container navbar-inner">
          <div className="flex-center gap-2">
            <span className="app-brand-icon">💼</span>
            <h1 className="app-title">Budget System</h1>
          </div>

          <div className="nav-tabs navbar-tabs">
            <NavLink
              to="/entitas"
              className={({ isActive }) =>
                `nav-tab ${isActive ? "active" : ""}`
              }
            >
              Entitas
            </NavLink>

            <NavLink
              to="/budget"
              className={({ isActive }) =>
                `nav-tab ${isActive ? "active" : ""}`
              }
            >
              Budget
            </NavLink>

            <NavLink
              to="/realisasi"
              className={({ isActive }) =>
                `nav-tab ${isActive ? "active" : ""}`
              }
            >
              Realisasi
            </NavLink>

            <NavLink
              to="/comparison"
              className={({ isActive }) =>
                `nav-tab ${isActive ? "active" : ""}`
              }
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `nav-tab ${isActive ? "active" : ""}`
              }
            >
              Sinkronisasi
            </NavLink>

            <div className="nav-auth">
              {user ? (
                <button
                  onClick={handleLogout}
                  className="nav-tab nav-tab-auth"
                >
                  Logout
                </button>
              ) : (
                <NavLink
                  to="/login"
                  className="nav-tab nav-tab-auth primary"
                >
                  Login
                </NavLink>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="app-container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/entitas"
            element={user ? <EntitasPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/budget"
            element={user ? <BudgetPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/realisasi"
            element={user ? <RealisasiPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/comparison"
            element={user ? <ComparisonPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/settings"
            element={user ? <AccurateSync /> : <Navigate to="/login" />}
          />

          <Route path="/" element={<Navigate to="/entitas" />} />
          <Route path="*" element={<Navigate to="/entitas" />} />
        </Routes>
      </main>
    </div>
  );
}
