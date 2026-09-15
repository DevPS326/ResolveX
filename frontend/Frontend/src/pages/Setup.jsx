import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Setup.css';

export default function Setup({ config, onSaved, mode = 'login' }) {
  const navigate = useNavigate();
  const [meHandle, setMeHandle] = useState(config?.meHandle || '');
  const [friends, setFriends] = useState(config?.friends || []);
  const [friendInput, setFriendInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMeHandle(config?.meHandle || '');
    setFriends(config?.friends || []);
  }, [config]);

  const addFriend = () => {
    const value = friendInput.trim();
    if (!value) return;
    if (value.toLowerCase() === meHandle.trim().toLowerCase()) {
      setError('Your own handle cannot be added as a friend.');
      return;
    }
    if (friends.some(f => f.toLowerCase() === value.toLowerCase())) {
      setFriendInput('');
      return;
    }
    setFriends(prev => [...prev, value]);
    setFriendInput('');
    setError('');
  };

  const removeFriend = (handle) => {
    setFriends(prev => prev.filter(f => f !== handle));
  };

  const onFriendKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addFriend();
    }
  };

  const save = async (e) => {
    e.preventDefault();
    const handle = meHandle.trim();
    if (!handle) {
      setError('Enter your Codeforces handle.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const saved = await api.saveConfig({ meHandle: handle, friends });
      onSaved?.(saved);
      api.sync().catch(() => {});
      navigate('/');
    } catch (err) {
      setError(err.message || 'Could not save tracker settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-shell">
        <div className="setup-kicker">CP COMBAT COMMAND</div>
        <h1>{mode === 'settings' ? 'EDIT TRACKER' : 'IDENTIFY YOUR SQUAD'}</h1>
        <p className="setup-subtitle">
          {mode === 'settings'
            ? 'Update your Codeforces handle or tracked friends. Changes apply to the command center immediately.'
            : 'Use your Codeforces handle as your tracker identity, then add the friends you want to monitor.'}
        </p>

        <form onSubmit={save} className="setup-card">
          <label className="setup-label" htmlFor="meHandle">YOUR CODEFORCES HANDLE</label>
          <input
            id="meHandle"
            className="setup-input"
            value={meHandle}
            onChange={e => setMeHandle(e.target.value)}
            placeholder="e.g. tourist"
            autoComplete="off"
            autoFocus={mode !== 'settings'}
          />

          <div className="setup-divider" />

          <label className="setup-label" htmlFor="friendHandle">TRACKED FRIENDS</label>
          <div className="friend-entry-row">
            <input
              id="friendHandle"
              className="setup-input"
              value={friendInput}
              onChange={e => setFriendInput(e.target.value)}
              onKeyDown={onFriendKeyDown}
              placeholder="Type a handle and press Enter"
              autoComplete="off"
            />
            <button type="button" className="btn btn-ghost setup-add" onClick={addFriend}>ADD</button>
          </div>

          <div className="friend-chip-list">
            {friends.length === 0 && (
              <div className="setup-empty">No friends added yet. You can add them now or later from Settings.</div>
            )}
            {friends.map(handle => (
              <div className="friend-chip" key={handle}>
                <span>{handle}</span>
                <button type="button" onClick={() => removeFriend(handle)} aria-label={`Remove ${handle}`}>×</button>
              </div>
            ))}
          </div>

          {error && <div className="setup-error">{error}</div>}

          <div className="setup-actions">
            {mode === 'settings' && (
              <button type="button" className="btn btn-subtle" onClick={() => navigate('/')}>CANCEL</button>
            )}
            <button type="submit" className="btn btn-primary setup-submit" disabled={saving}>
              {saving ? 'VALIDATING…' : mode === 'settings' ? 'SAVE & SYNC' : 'ENTER COMMAND CENTER'}
            </button>
          </div>
        </form>

        <div className="setup-note">Handles are validated against Codeforces before saving.</div>
      </div>
    </div>
  );
}
