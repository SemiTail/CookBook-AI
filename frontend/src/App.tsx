import {RepostProvider} from './Reposts';
import {GuestCatalogPage} from './pages/GuestCatalogPage';
import {ReportDrawer,type ReportTarget} from './ReportDrawer';
import {AdminDrawer} from './AdminDrawer';
import {AssignmentsPage,ManagementPage} from './pages/ManagementPage';
import {MentionsMenu} from "./MentionsMenu";
import {AccountMenu} from "./AccountMenu";
import {LibraryPage,StatisticsPage} from "./pages/LibraryPage";
import { ProfilePage } from "./pages/ProfilePage";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { getSession, saveSession, SESSION_EXPIRED_EVENT } from "./api";
import type { Session } from "./types";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RecipePage } from "./pages/RecipePage";
import { ThemeToggle } from "./ThemeToggle";

const ReportsPage=lazy(()=>import("./pages/ReportsPage").then(m=>({default:m.ReportsPage})));
const SupportPage=lazy(()=>import("./pages/SupportPage").then(m=>({default:m.SupportPage})));
const ModerationPage=lazy(()=>import("./pages/ModerationPage").then(m=>({default:m.ModerationPage})));
const ActivityPage=lazy(()=>import("./pages/ActivityPage").then(m=>({default:m.ActivityPage})));
const RecipeEditorPage=lazy(()=>import("./pages/RecipeEditorPage").then(m=>({default:m.RecipeEditorPage})));

export default function App() {
  const [session, setSession] = useState<Session | null>(getSession);
  const navigate = useNavigate();
  const [adminsOpen,setAdminsOpen]=useState(false);
  const [reportTarget,setReportTarget]=useState<ReportTarget|null>(null);
  useEffect(()=>{const open=(e:Event)=>setReportTarget((e as CustomEvent<ReportTarget>).detail);window.addEventListener('cookbook-report',open);return()=>window.removeEventListener('cookbook-report',open);},[]);
  const closeAdmins=useCallback(()=>setAdminsOpen(false),[]);
  useEffect(()=>{const open=()=>setAdminsOpen(true);window.addEventListener('cookbook-admins-open',open);return()=>window.removeEventListener('cookbook-admins-open',open);},[]);
  const onLogin = useCallback((newSession: Session) => { saveSession(newSession); setSession(newSession); navigate("/dashboard"); }, [navigate]);
  const logout = useCallback(() => { saveSession(null); setSession(null); setAdminsOpen(false); setReportTarget(null);navigate("/login"); }, [navigate]);
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, logout);
  }, [logout]);
  const loggedIn = Boolean(session);
  return <RepostProvider identity={session?.user.id}>
    <header className="header">
      <Link to="/dashboard" className="brand"><span className="brand-logo">✳</span> CookBook <em>AI</em></Link>
      <nav>
        <ThemeToggle />{loggedIn&&<MentionsMenu key={session?.user.id}/>}
        {loggedIn ? <><Link to="/dashboard">Головна</Link><AccountMenu name={session?.user.name??"Користувач"} onLogout={logout}/></> :
          <><Link to="/dashboard">Рецепти</Link><Link to="/login">Вхід</Link><Link to="/register" className="button button-small">Реєстрація</Link></>}
      </nav>
    </header>
    <main className="container">
      <Suspense fallback={<p role="status">Завантажуємо розділ…</p>}><Routes>
        <Route path='/moderation/reports' element={loggedIn?<ReportsPage/>:<Navigate to='/login' replace/>}/>
        <Route path='/moderation/support' element={loggedIn?<SupportPage/>:<Navigate to='/login' replace/>}/>
        <Route path='/administration' element={loggedIn?<AssignmentsPage/>:<Navigate to='/login' replace/>}/>
        <Route path='/manage/:id' element={loggedIn?<ManagementPage/>:<Navigate to='/login' replace/>}/>
        <Route path='/moderation' element={loggedIn?<ModerationPage/>:<Navigate to='/login' replace/>}/>
        <Route path='/moderation/users/:id' element={loggedIn?<ModerationPage/>:<Navigate to='/login' replace/>}/>
        <Route path="/login" element={loggedIn ? <Navigate to="/dashboard" replace /> : <AuthPage key="login" kind="login" onLogin={onLogin} />} />
        <Route path="/register" element={loggedIn ? <Navigate to="/dashboard" replace /> : <AuthPage key="register" kind="register" onLogin={onLogin} />} />
        <Route path="/statistics/ratings" element={loggedIn?<ActivityPage key="ratings" kind="ratings"/>:<Navigate to="/login" replace/>}/>
        <Route path="/statistics/comments/mine" element={loggedIn?<ActivityPage key="mine-comments" kind="mine"/>:<Navigate to="/login" replace/>}/>
        <Route path="/statistics/comments/community" element={loggedIn?<ActivityPage key="community-comments" kind="community"/>:<Navigate to="/login" replace/>}/>
        <Route path="/statistics" element={loggedIn?<StatisticsPage/>:<Navigate to="/login" replace/>}/>
        <Route path="/saved" element={loggedIn?<LibraryPage key="saved" kind="saved"/>:<Navigate to="/login" replace/>}/>
        <Route path="/following" element={loggedIn?<LibraryPage key="following" kind="following"/>:<Navigate to="/login" replace/>}/>
        <Route path="/history" element={loggedIn?<LibraryPage key="history" kind="history"/>:<Navigate to="/login" replace/>}/>
        <Route path="/profile" element={loggedIn ? <ProfilePage /> : <Navigate to="/login" replace />} />
        <Route path="/users/:id" element={<ProfilePage/>} />
        <Route path="/dashboard" element={loggedIn ? <DashboardPage onUnauthorized={logout} /> : <GuestCatalogPage/>} />
        <Route path="/recipes" element={<GuestCatalogPage/>}/>
        <Route path="/recipes/:id" element={<RecipePage />} />
        <Route path="/recipes/new" element={loggedIn ? <RecipeEditorPage /> : <Navigate to="/login" replace />} />
        <Route path="/recipes/:id/edit" element={loggedIn ? <RecipeEditorPage /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes></Suspense>
    </main>
    {loggedIn&&reportTarget&&<ReportDrawer key={reportTarget.type+reportTarget.id} target={reportTarget} onClose={()=>setReportTarget(null)}/>}
    {loggedIn&&adminsOpen&&<AdminDrawer onClose={closeAdmins}/>}
    <footer>CookBook AI · навчальний проєкт · React + NestJS + SQLite</footer>
  </RepostProvider>;
}
