import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import './Setup.css';

export default function Account({ mode = 'login', onSignedIn }) {
  const registering = mode === 'register';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const submit = async event => {
    event.preventDefault();
    if (registering && password !== confirm) { setError('The passwords do not match.'); return; }
    setPending(true); setError('');
    try {
      await (registering ? api.register : api.signIn)({ email: email.trim(), password });
      await onSignedIn();
    } catch (err) { setError(err.message || 'Unable to sign in. Please try again.'); }
    finally { setPending(false); }
  };
  return (
    <div className="setup-page account-page">
      <div className="setup-shell account-shell">
        <div className="setup-kicker">Your personal Codeforces workspace</div>
        <h1>{registering ? 'Create your account' : 'Welcome back'}</h1>
        <p className="setup-subtitle">{registering ? 'Keep your tracker and friends together, wherever you sign in.' : 'Sign in to pick up where you left off.'}</p>
        <form className="setup-card" onSubmit={submit}>
          <label className="setup-label" htmlFor="account-email">Email</label>
          <input className="setup-input" id="account-email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} required value={email} disabled={pending} onChange={e => setEmail(e.target.value)} />
          <label className="setup-label account-field" htmlFor="account-password">Password</label>
          <input className="setup-input" id="account-password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 12 : undefined} maxLength={128} required value={password} disabled={pending} onChange={e => setPassword(e.target.value)} aria-describedby={registering ? 'password-help' : undefined} />
          {registering && <>
            <p id="password-help" className="account-help">Use at least 12 characters. A long, memorable phrase works well.</p>
            <label className="setup-label account-field" htmlFor="account-confirm">Confirm password</label>
            <input className="setup-input" id="account-confirm" type="password" autoComplete="new-password" required maxLength={128} value={confirm} disabled={pending} onChange={e => setConfirm(e.target.value)} />
          </>}
          {error && <div className="setup-error" role="alert">{error}</div>}
          <button className="btn btn-primary account-submit" type="submit" disabled={pending}>{pending ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="account-switch">{registering ? 'Already have an account?' : 'New to ResolveX?'} <Link to={registering ? '/login' : '/register'}>{registering ? 'Sign in' : 'Create an account'}</Link></p>
      </div>
    </div>
  );
}
