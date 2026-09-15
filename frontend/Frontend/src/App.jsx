import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProblemIntelligence from './pages/ProblemIntelligence';
import FriendProfile from './pages/FriendProfile';
import './App.css';

function AppHeader() {
  const loc = useLocation();
  const navCls = (prefix) =>
    loc.pathname === prefix || (prefix !== '/' && loc.pathname.startsWith(prefix))
      ? 'nav-link active'
      : 'nav-link';

  return (
    <header className="app-header">
      <div className="app-brand">
        <span className="app-brand-name">CP COMBAT COMMAND</span>
        <span className="app-brand-sub">INTELLIGENCE ENGINE</span>
      </div>
      <nav className="app-nav">
        <Link to="/" className={navCls('/')}>Command Center</Link>
      </nav>
      <div className="app-header-right">
        <div className="db-status">
          <span className="status-dot" />
          DB LIVE
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="app">
      <AppHeader />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/problem/:contestId/:index" element={<ProblemIntelligence />} />
        <Route path="/friend/:handle" element={<FriendProfile />} />
      </Routes>
    </div>
  );
}
