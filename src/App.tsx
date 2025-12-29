import React from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";

import { BudgetPage } from "./pages/BudgetPage";
import { RealisasiPage } from "./pages/RealisasiPage";
import { AccurateSync } from "./pages/SettingsPage";
import { LoginPage } from "./pages/LoginPage";
import { ComparisonPage } from "./pages/DashboardPage";
import { useAuth } from "./contexts/AuthContext";

export default function App() {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="fade-in">
      {/* Navbar */}
      <nav className="app-navbar">
        <div className="app-container navbar-inner">
          {/* Brand */}
          <div className="flex-center gap-2">
            <span className="app-brand-icon">💼</span>
            <h1 className="app-title">Budget System</h1>
          </div>

          {/* Tabs */}
          <div className="nav-tabs navbar-tabs">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `nav-tab ${isActive ? "active" : ""}`
              }
            >
              📊 Budget
            </NavLink>

            <NavLink
              to="/realisasi"
              className={({ isActive }) =>
                `nav-tab ${isActive ? "active" : ""}`
              }
            >
              📈 Realisasi
            </NavLink>

            <NavLink
              to="/comparison"
              className={({ isActive }) =>
                `nav-tab ${isActive ? "active" : ""}`
              }
            >
              📊 Dashboard
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `nav-tab ${isActive ? "active" : ""}`
              }
            >
              ⚙️ Sinkronisasi
            </NavLink>

            {/* Auth */}
            <div className="nav-auth">
              {user ? (
                <NavLink
                  to="/login"
                  onClick={handleLogout}
                  className="nav-tab nav-tab-auth"
                >
                  Logout
                </NavLink>
              ) : (
                <NavLink to="/login" className="nav-tab nav-tab-auth primary">
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
          {/* PUBLIC */}
          <Route path="/" element={<BudgetPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* PROTECTED */}
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

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
