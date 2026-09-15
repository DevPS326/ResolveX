import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import GroupedFeed from '../components/GroupedFeed';

const BAR_COLORS = ['#00f2ff','#bc13fe','#4ade80','#fb923c','#f87171','#fbbf24','#a78bfa','#38bdf8'];

function MiniBarChart({ data, maxItems = 8 }) {
  if (!data || Object.keys(data).length === 0) {
    return <div className="empty-state" style={{ padding: '12px 0' }}>No data.</div>;
  }
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, maxItems);
  const maxVal = Math.max(...entries.map(e => e[1]));
  return (
    <div className="mini-bar-chart">
      {entries.map(([label, count], i) => (
        <div key={label} className="mini-bar-row">
          <span className="mini-bar-label" title={label}>
            {label.length > 20 ? label.slice(0, 19) + '…' : label}
          </span>
          <div className="mini-bar-track">
            <div
              className="mini-bar-fill"
              style={{ width: `${(count / maxVal) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
            />
          </div>
          <span className="mini-bar-count">{count}</span>
        </div>
      ))}
    </div>
  );
}

export default function FriendProfile() {
  const { handle } = useParams();
  const [fingerprint, setFingerprint] = useState(null);
  const [activity,    setActivity]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const [fpRes, actRes] = await Promise.all([
          api.friendFingerprint(handle),
          api.activity(200),
        ]);
        if (cancelled) return;
        setFingerprint(fpRes.fingerprint || null);
        setActivity((actRes.activity || []).filter(a => a.handle === handle));
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [handle]);

  if (loading) return (
    <div className="page-loading">
      LOADING PROFILE — {handle}
      <div className="loading-bar" />
    </div>
  );
  if (error) return <div className="page-error">Error: {error}</div>;

  const fp = fingerprint || {};

  return (
    <div className="friend-profile">

      {/* Header */}
      <div className="fp-header">
        <div className="fp-breadcrumb">
          <Link to="/">← Command Center</Link>
          {' / '}Peer Profile
        </div>
        <div className="fp-title-row">
          <h1 className="fp-handle">{handle}</h1>
          <a
            href={`https://codeforces.com/profile/${handle}`}
            target="_blank" rel="noreferrer"
            className="btn btn-subtle btn-sm"
          >
            CF PROFILE ↗
          </a>
        </div>
        {fp.totalSubmissions != null && (
          <div className="fp-stats-row">
            <div className="fp-stat">
              <label>Total Subs</label>
              <span>{fp.totalSubmissions}</span>
            </div>
            <div className="fp-stat">
              <label>Solved</label>
              <span>{fp.totalSolved || 0}</span>
            </div>
            <div className="fp-stat">
              <label>Avg Attempts / AC</label>
              <span>{fp.avgAttemptsToAC != null ? fp.avgAttemptsToAC.toFixed(1) : '—'}</span>
            </div>
            <div className="fp-stat">
              <label>Median Time</label>
              <span>{fp.medianSolvingDuration ? `${Math.round(fp.medianSolvingDuration / 60)}m` : '—'}</span>
            </div>
            <div className="fp-stat">
              <label>7-Day Solves</label>
              <span>{fp.recentActivity?.last7days ?? '—'}</span>
            </div>
          </div>
        )}
        {!fp.totalSubmissions && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginTop: 8 }}>
            No fingerprint data — sync this handle first.
          </div>
        )}
      </div>

      {/* Charts grid */}
      {fp.totalSubmissions != null && (
        <div className="fp-grid">
          <div className="fp-chart-card">
            <div className="fp-chart-title">Top Tags</div>
            <MiniBarChart data={fp.tagDistribution} />
          </div>
          <div className="fp-chart-card">
            <div className="fp-chart-title">Languages</div>
            <MiniBarChart data={fp.languageDistribution} />
          </div>
          <div className="fp-chart-card">
            <div className="fp-chart-title">Difficulty Distribution</div>
            <MiniBarChart data={fp.ratingDistribution} />
          </div>
          <div className="fp-chart-card">
            <div className="fp-chart-title">Verdict Distribution</div>
            <MiniBarChart data={fp.verdictDistribution} />
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)', borderRadius: 6, padding: '16px 20px' }}>
        <div className="section-row-header" style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '3px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Recent Activity
          </h2>
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>{activity.length} submissions</span>
        </div>
        {activity.length === 0 ? (
          <div className="empty-state">No recent activity for {handle}.</div>
        ) : (
          <GroupedFeed activity={activity} maxItems={20} showHandle={false} />
        )}
      </div>

    </div>
  );
}
