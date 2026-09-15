import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProblemIntelligence from './pages/ProblemIntelligence';
import FriendProfile from './pages/FriendProfile';
import Setup from './pages/Setup';
import { api } from './services/api';
import './App.css';

function AppHeader({ config }) {
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
        <Link to="/settings" className={navCls('/settings')}>Settings</Link>
      </nav>
      <div className="app-header-right">
        <div className="db-status" title="Current Codeforces identity">
          <span className="status-dot" />
          {config?.meHandle ? `@${config.meHandle}` : 'DB LIVE'}
        </div>
      </div>
    </header>
  );
}

function Protected({ configured, children }) {
  return configured ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState('');

  const loadConfig = useCallback(async () => {
    setConfigError('');
    try {
      const data = await api.getConfig();
      setConfig(data);
    } catch (err) {
      setConfigError(err.message || 'Could not reach tracker backend.');
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  if (!config && !configError) {
    return (
      <div className="page-loading">
        <div className="loading-bar" />
        CONNECTING TO COMMAND NETWORK…
      </div>
    );
  }

  if (configError && !config) {
    return (
      <div className="page-error">
        <div>{configError}</div>
        <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={loadConfig}>RETRY</button>
      </div>
    );
  }

  const configured = Boolean(config?.configured);

  return (
    <div className="app">
      {configured && <AppHeader config={config} />}
      <Routes>
        <Route
          path="/login"
          element={configured
            ? <Navigate to="/" replace />
            : <Setup config={config} onSaved={setConfig} mode="login" />}
        />
        <Route
          path="/settings"
          element={
            <Protected configured={configured}>
              <Setup config={config} onSaved={setConfig} mode="settings" />
            </Protected>
          }
        />
        <Route
          path="/"
          element={
            <Protected configured={configured}>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/problem/:contestId/:index"
          element={
            <Protected configured={configured}>
              <ProblemIntelligence />
            </Protected>
          }
        />
        <Route
          path="/friend/:handle"
          element={
            <Protected configured={configured}>
              <FriendProfile />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to={configured ? '/' : '/login'} replace />} />
      </Routes>
    </div>
  );
}
