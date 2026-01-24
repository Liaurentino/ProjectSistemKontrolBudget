import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useState } from "react";

import BudgetPage from "./pages/Budget/BudgetPage";
import BudgetRealizationPage from "./pages/Realisasi/BudgetRealisasiPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import { EntitasPage } from "./pages/Entitas/EntitasPage";
import CoaPage from "./pages/COA/CoaPage";
import PublicProfilesPage from "./pages/PublicUsers/PublicUsersPage";
import { useAuth } from "./contexts/AuthContext";
import AuthPage from "./pages/Auth/AuthPage";

export default function App() {
  const { user, loading, signOut } = useAuth();
  const [expandedMenu, setExpandedMenu] = useState<string | null>("master-data");

  const handleLogout = async () => {
    await signOut();
  };

  const toggleMenu = (menuId: string) => {
    setExpandedMenu(expandedMenu === menuId ? null : menuId);
  };

  if (loading) {
    return <div className="app-loading">Loading...</div>;
  }

  return (
    <div className="fade-in app-layout">
      {/* Sidebar */}
      {user && (
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

            {/* ✨ TAMBAH INI - Community Profiles */}
            <NavLink
              to="/community"
              className={({ isActive }) =>
                `sidebar-menu-item ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-menu-label">🌐 Community</span>
            </NavLink>
          </nav>

          {/* Sidebar Footer */}
          <div className="sidebar-footer">
            <div className="sidebar-status">
              <span className="sidebar-status-indicator"></span>
              <span className="sidebar-status-text">{user?.email || "User"}</span>
            </div>

            {user && (
              <button
                onClick={handleLogout}
                className="btn btn-outline btn-sm btn-full"
              >
                Logout
              </button>
            )}
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className={`app-main-content ${!user ? "no-sidebar" : ""}`}>
        {/* Page Content */}
        <main className="app-container">
          <Routes>
            <Route path="/login" element={<AuthPage />} />

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
            
            {/* ✨ TAMBAH INI - Route Community */}
            <Route
              path="/community"
              element={user ? <PublicProfilesPage /> : <Navigate to="/login" />}
            />

            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}