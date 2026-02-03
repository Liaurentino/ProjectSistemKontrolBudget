import { Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

import BudgetPage from "./pages/Budget/BudgetPage";
import BudgetRealizationPage from "./pages/Realisasi/BudgetRealisasiPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import { EntitasPage } from "./pages/Entitas/EntitasPage";
import CoaPage from "./pages/COA/CoaPage";
import PublicProfilesPage from "./pages/PublicUsers/PublicUsersPage";
import { useAuth } from "./contexts/AuthContext";
import AuthPage from "./pages/Auth/AuthPage";
import ResetPasswordPage from "./pages/Auth/ResetPasswordPage";
import AccurateOAuthCallback from "./pages/Auth/AccurateOauthCallback";

export default function App() {
  const { user, loading, signOut } = useAuth();
  const [expandedMenu, setExpandedMenu] = useState<string | null>("master-data");
  const location = useLocation();
  const [previousUser, setPreviousUser] = useState(user);

  // Detect when user just logged in (transition from null to user)
  const isJustLoggedIn = !previousUser && user;

  useEffect(() => {
    setPreviousUser(user);
  }, [user]);

  const handleLogout = async () => {
    await signOut();
  };

  const toggleMenu = (menuId: string) => {
    setExpandedMenu(expandedMenu === menuId ? null : menuId);
  };

  // Guard: Show loading screen while auth state is being determined
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  // Check if we're on auth pages
  const isAuthPage = location.pathname === '/login' || location.pathname === '/reset-password';

  // Show sidebar only when:
  // 1. User is logged in
  // 2. NOT on auth pages
  // 3. NOT just logged in (to prevent flash during redirect)
  const shouldShowSidebar = user && !isAuthPage && !isJustLoggedIn;

  return (
    <div className="fade-in app-layout">
      {/* Sidebar */}
      {shouldShowSidebar && (
        <aside className="app-sidebar">
          {/* Sidebar Header */}
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <div className="sidebar-logo-text">
                <h3>Sistem Kontrol Budget</h3>
                <p>Budget vs Realisasi Multi Entitas</p>
              </div>
            </div>
          </div>

          {/* Sidebar Navigation */}
          <nav className="sidebar-nav">
            {/* Dashboard */}
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `sidebar-menu-item ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-menu-label">Dashboard</span>
            </NavLink>

            {/* Master Data */}
            <div>
              <button
                onClick={() => toggleMenu("master-data")}
                className="sidebar-menu-item"
              >
                <span className="sidebar-menu-label">Data Usaha</span>
                <span
                  className={`sidebar-menu-arrow ${
                    expandedMenu === "master-data" ? "expanded" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {expandedMenu === "master-data" && (
                <div className="sidebar-submenu">
                  <NavLink
                    to="/entitas"
                    className={({ isActive }) =>
                      `sidebar-menu-item child ${isActive ? "active" : ""}`
                    }
                  >
                    <span className="sidebar-menu-label">List Entitas</span>
                  </NavLink>

                  <NavLink
                    to="/akun"
                    className={({ isActive }) =>
                      `sidebar-menu-item child ${isActive ? "active" : ""}`
                    }
                  >
                    <span className="sidebar-menu-label">List Akun</span>
                  </NavLink>

                  <NavLink
                    to="/budget"
                    className={({ isActive }) =>
                      `sidebar-menu-item child ${isActive ? "active" : ""}`
                    }
                  >
                    <span className="sidebar-menu-label">Budget Entry</span>
                  </NavLink>
                </div>
              )}
            </div>

            {/* Realisasi */}
            <NavLink
              to="/realisasi"
              className={({ isActive }) =>
                `sidebar-menu-item ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-menu-label">Realisasi</span>
            </NavLink>

            {/* Lihat User Lain */}
            <NavLink
              to="/community"
              className={({ isActive }) =>
                `sidebar-menu-item ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-menu-label">Lihat User Lain</span>
            </NavLink>
          </nav>

          {/* Sidebar Footer */}
          <div className="sidebar-footer">
            <div className="sidebar-status">
              <span className="sidebar-status-indicator"></span>
              <span className="sidebar-status-text">{user?.email || "User"}</span>
            </div>

            <button
              onClick={handleLogout}
              className="btn btn-outline btn-sm btn-full"
            >
              Logout
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className={`app-main-content ${!shouldShowSidebar ? "no-sidebar" : ""}`}>
        {/* Page Content */}
        <main className="app-container">
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route
              path="/entitas"
              element={user ? <EntitasPage /> : <Navigate to="/login" />}
            />
            <Route
              path="/akun"
              element={user ? <CoaPage /> : <Navigate to="/login" />}
            />
            <Route
              path="/budget"
              element={user ? <BudgetPage /> : <Navigate to="/login" />}
            />
            <Route
              path="/realisasi"
              element={
                user ? <BudgetRealizationPage /> : <Navigate to="/login" />
              }
            />
            <Route
              path="/dashboard"
              element={user ? <DashboardPage /> : <Navigate to="/login" />}
            />
            <Route
              path="/community"
              element={user ? <PublicProfilesPage /> : <Navigate to="/login" />}
            />

            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
            <Route path="/oauth/accurate/callback" element={<AccurateOAuthCallback />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}