import { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProblemIntelligence from './pages/ProblemIntelligence';
import FriendProfile from './pages/FriendProfile';
import Setup from './pages/Setup';
import Account from './pages/Account';
import { api } from './services/api';
import './App.css';

function AppHeader({ config, account, onSignOut, signingOut }) {
  const loc = useLocation();
  const navCls = (prefix) =>
    loc.pathname === prefix || (prefix !== '/' && loc.pathname.startsWith(prefix))
      ? 'nav-link active'
      : 'nav-link';

  return (
    <header className="app-header">
      <Link to="/" className="app-brand" aria-label="ResolveX home">
        <span className="brand-mark" aria-hidden="true">↗</span>
        <span className="app-brand-name">ResolveX</span>
        <span className="app-brand-sub">Codeforces tracker</span>
      </Link>
      {account && config?.configured && <nav className="app-nav" aria-label="Main navigation">
        <Link to="/" className={navCls('/')} aria-current={loc.pathname === '/' ? 'page' : undefined}>Overview</Link>
        <Link to="/settings" className={navCls('/settings')} aria-current={loc.pathname === '/settings' ? 'page' : undefined}>Settings</Link>
      </nav>}
      <div className="app-header-right">
        <div className="db-status" title="Current Codeforces identity">
          {account && <span className="status-dot" />}
          {config?.meHandle ? `@${config.meHandle}` : account?.email || 'Your workspace'}
        </div>
        {account && <button className="btn btn-subtle" onClick={onSignOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>}
      </div>
    </header>
  );
}


const signedOut = { account: null, config: null, loading: false, error: '' };
async function loadWorkspace() {
  try {
    const { account } = await api.currentAccount();
    const config = await api.getConfig();
    return { account, config, loading: false, error: '' };
  } catch (err) {
    if (err.status === 401) return signedOut;
    return { ...signedOut, error: err.message || 'Could not load your workspace.' };
  }
}
function Protected({ account, configured, children }) {
  if (!account) return <Navigate to="/login" replace />;
  return configured ? children : <Navigate to="/setup" replace />;
}
export default function App() {
  const location = useLocation();
  const [workspace, setWorkspace] = useState({ ...signedOut, loading: true });
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const { account, config, loading, error } = workspace;
  const configured = Boolean(config?.configured);
  const refresh = async () => { setWorkspace(await loadWorkspace()); };
  useEffect(() => {
    let active = true;
    loadWorkspace().then(state => { if (active) setWorkspace(state); });
    const expired = () => setWorkspace(signedOut);
    window.addEventListener('resolvex:session-expired', expired);
    // Another tab may sign out or switch accounts; never keep its old tracker visible.
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('resolvex-account') : null;
    if (channel) channel.onmessage = () => window.location.reload();
    return () => { active = false; channel?.close(); window.removeEventListener('resolvex:session-expired', expired); };
  }, []);
  useEffect(() => {
    const parts = location.pathname.split('/');
    const page = ({ settings: 'Settings', login: 'Sign in', register: 'Create account', setup: 'Set up your tracker' })[parts[1]] || (parts[1] === 'friend' ? `${parts[2] || ''} · Profile` : parts[1] === 'problem' ? `${parts[2] || ''}${parts[3] || ''} · Problem details` : 'Overview');
    document.title = `${page} | ResolveX`;
  }, [location.pathname]);
  const notifyTabs = () => {
    if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel('resolvex-account'); channel.postMessage('changed'); channel.close(); }
  };
  const onSignedIn = async () => { await refresh(); notifyTabs(); };
  const onSignOut = async () => {
    setSigningOut(true); setLogoutError('');
    try { await api.signOut(); setWorkspace(signedOut); notifyTabs(); }
    catch { setLogoutError('Could not sign out. Please try again.'); }
    finally { setSigningOut(false); }
  };
  const onSaved = next => setWorkspace(prev => ({ ...prev, config: next }));
  const protect = children => <Protected account={account} configured={configured}>{children}</Protected>;
  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <AppHeader config={config} account={account} onSignOut={onSignOut} signingOut={signingOut} />
      <main id="main-content" tabIndex={-1}>
        {logoutError && <div className="dashboard-error" role="alert">{logoutError}</div>}
        {loading ? <div className="page-loading" role="status"><div className="loading-bar" />Loading your workspace…</div> : error ? <div className="page-error" role="alert">{error}<div><button className="btn btn-subtle" onClick={refresh}>Try again</button></div></div> :
          <Routes key={account?.email || 'signed-out'}>
            <Route path="/login" element={account ? <Navigate to={configured ? '/' : '/setup'} replace /> : <Account key="login" onSignedIn={onSignedIn} />} />
            <Route path="/register" element={account ? <Navigate to={configured ? '/' : '/setup'} replace /> : <Account key="register" mode="register" onSignedIn={onSignedIn} />} />
            <Route path="/setup" element={!account ? <Navigate to="/login" replace /> : configured ? <Navigate to="/" replace /> : <Setup config={config} onSaved={onSaved} />} />
            <Route path="/settings" element={protect(<Setup config={config} onSaved={onSaved} mode="settings" />)} />
            <Route path="/" element={protect(<Dashboard />)} />
            <Route path="/problem/:contestId/:index" element={protect(<ProblemIntelligence />)} />
            <Route path="/friend/:handle" element={protect(<FriendProfile />)} />
            <Route path="*" element={<Navigate to={account ? configured ? '/' : '/setup' : '/login'} replace />} />
          </Routes>
        }
      </main>
      <footer className="app-footer">
        <span>© {new Date().getFullYear()} <a href="https://github.com/DevPS326" target="_blank" rel="noopener noreferrer">DevPS326</a>. All rights reserved.</span>
        <a className="footer-github" href="https://github.com/DevPS326" target="_blank" rel="noopener noreferrer" aria-label="Visit DevPS326 on GitHub (opens in a new tab)">GitHub ↗</a>
      </footer>
    </div>
  );
}
