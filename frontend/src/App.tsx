import { ProfilePage } from "./pages/ProfilePage";
import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { getSession, saveSession, SESSION_EXPIRED_EVENT } from "./api";
import type { Session } from "./types";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RecipePage } from "./pages/RecipePage";
import { RecipeEditorPage } from "./pages/RecipeEditorPage";
import { ThemeToggle } from "./ThemeToggle";

export default function App() {
  const [session, setSession] = useState<Session | null>(getSession);
  const navigate = useNavigate();
  const onLogin = useCallback((newSession: Session) => { saveSession(newSession); setSession(newSession); navigate("/dashboard"); }, [navigate]);
  const logout = useCallback(() => { saveSession(null); setSession(null); navigate("/login"); }, [navigate]);
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, logout);
  }, [logout]);
  const loggedIn = Boolean(session);
  return <>
    <header className="header">
      <Link to="/dashboard" className="brand"><span className="brand-logo">✳</span> CookBook <em>AI</em></Link>
      <nav>
        <ThemeToggle />
        {loggedIn ? <><Link to="/dashboard">Головна</Link><Link to="/profile">Мій профіль</Link><button className="button button-small button-outline" onClick={logout}>Вийти</button></> :
          <><Link to="/login">Вхід</Link><Link to="/register" className="button button-small">Реєстрація</Link></>}
      </nav>
    </header>
    <main className="container">
      <Routes>
        <Route path="/login" element={loggedIn ? <Navigate to="/dashboard" replace /> : <AuthPage key="login" kind="login" onLogin={onLogin} />} />
        <Route path="/register" element={loggedIn ? <Navigate to="/dashboard" replace /> : <AuthPage key="register" kind="register" onLogin={onLogin} />} />
        <Route path="/profile" element={loggedIn ? <ProfilePage /> : <Navigate to="/login" replace />} />
        <Route path="/users/:id" element={loggedIn ? <ProfilePage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard" element={loggedIn ? <DashboardPage onUnauthorized={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/recipes/:id" element={loggedIn ? <RecipePage /> : <Navigate to="/login" replace />} />
        <Route path="/recipes/new" element={loggedIn ? <RecipeEditorPage /> : <Navigate to="/login" replace />} />
        <Route path="/recipes/:id/edit" element={loggedIn ? <RecipeEditorPage /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={loggedIn ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </main>
    <footer>CookBook AI · навчальний проєкт · React + NestJS + SQLite</footer>
  </>;
}
