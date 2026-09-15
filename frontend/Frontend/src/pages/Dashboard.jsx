import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import GroupedFeed from '../components/GroupedFeed';
import SkillGapPanel from '../components/SkillGapPanel';
import LearningTargets from '../components/LearningTargets';
import VerdictBadge from '../components/VerdictBadge';
import { groupIntoJourneys } from '../utils/groupActivity';

// ── Helpers ────────────────────────────────────────────────
const relTime = (sec) => {
  if (!sec) return '—';
  const d = Math.floor(Date.now() / 1000) - sec;
  if (d < 60)    return 'just now';
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

const formatDur = (s) => {
  if (!s || s < 60) return null;
  return s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

// ── Derived Attention Items ────────────────────────────────
function buildAttentionItems(journeys, skillGaps, targets) {
  const items = [];

  // Interesting journeys: multi-attempt solved, most recent first
  const interesting = journeys.filter(j => j.attemptCount >= 3 && j.solved).slice(0, 2);
  for (const j of interesting) {
    items.push({ type: 'journey', journey: j });
  }

  // Unsolved high-attempt journeys
  const struggling = journeys.filter(j => j.attemptCount >= 4 && !j.solved).slice(0, 1);
  for (const j of struggling) {
    items.push({ type: 'journey', journey: j, variant: 'struggling' });
  }

  // Top gap
  const topGap = skillGaps.find(g => g.gapLevel !== 'NONE');
  if (topGap) items.push({ type: 'gap', gap: topGap });

  // Top target
  if (targets.length > 0) items.push({ type: 'target', target: targets[0] });

  return items.slice(0, 5);
}

// ── Intel Strip ────────────────────────────────────────────
function IntelStrip({ rivals, journeys, skillGaps, syncStatus, lastFetch, nowSec }) {
  const recentSolves = journeys.filter(j => {
    const hoursAgo = (nowSec - (j.lastAt || 0)) / 3600;
    return j.solved && hoursAgo < 24;
  }).length;

  const multiJourneys = journeys.filter(j => j.attemptCount >= 3).length;
  const topGap = skillGaps.find(g => g.gapLevel !== 'NONE');
  const activePeers = rivals.filter(r => (r.velocity || 0) > 0).length;

  const updatedAgo = lastFetch
    ? relTime(Math.floor(lastFetch / 1000))
    : '—';

  return (
    <div className="intel-strip">
      <div className="metric-tile">
        <div className="metric-label">Friends followed</div>
        <div className="metric-value accent">{rivals.length}</div>
        <div className="metric-sub">{activePeers} active this week</div>
      </div>
      <div className="metric-tile">
        <div className="metric-label">Friends’ solves</div>
        <div className="metric-value">{recentSolves}</div>
        <div className="metric-sub">last 24h</div>
      </div>
      <div className="metric-tile">
        <div className="metric-label">Repeat attempts</div>
        <div className="metric-value">{multiJourneys}</div>
        <div className="metric-sub">Problems with 3+ attempts</div>
      </div>
      <div className="metric-tile">
        <div className="metric-label">Focus area</div>
        <div className={`metric-value ${topGap?.gapLevel === 'HIGH' ? 'danger' : topGap?.gapLevel === 'MEDIUM' ? 'warn' : ''}`}>
          {topGap ? topGap.tag : '—'}
        </div>
        <div className="metric-sub">{topGap ? `${topGap.gapLevel} gap` : 'no gaps detected'}</div>
      </div>
      <div className="metric-tile">
        <div className="metric-label">Last checked</div>
        <div className="metric-value" style={{ fontSize: '0.85rem' }}>{updatedAgo}</div>
        <div className="metric-sub">
          {syncStatus?.handles?.filter(h => h.status === 'done').length || 0}
          /{syncStatus?.handles?.length || 0} synced
        </div>
      </div>
    </div>
  );
}

// ── Attention Card ─────────────────────────────────────────
function AttentionCard({ item }) {
  if (item.type === 'journey') {
    const { journey: j, variant } = item;
    const dur = formatDur(j.duration);
    return (
      <div className={`attention-card type-journey`}>
        <div className={`ac-type journey`}>
          {variant === 'struggling' ? 'Still in progress' : 'Persistence paid off'}
        </div>
        <div className="ac-title">
          <Link to={`/friend/${j.handle}`}>{j.handle}</Link>
          {' — '}
          <Link to={`/problem/${j.contestId}/${j.problemIndex}`}>
            {j.contestId}{j.problemIndex}{j.problemName ? ` ${j.problemName}` : ''}
          </Link>
        </div>
        <div className="ac-verdicts">
          {j.verdicts.map((v, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              {i > 0 && <span className="verdict-sep">→</span>}
              <VerdictBadge verdict={v} />
            </span>
          ))}
        </div>
        <div className="ac-meta">
          <span>{j.attemptCount} attempts</span>
          {dur && <span>{dur}</span>}
          {j.problemRating && <span className="rating-badge">{j.problemRating}</span>}
        </div>
        <div className="ac-footer">
          <span />
          <Link to={`/problem/${j.contestId}/${j.problemIndex}`} className="btn-link btn-sm">
            View problem →
          </Link>
        </div>
      </div>
    );
  }

  if (item.type === 'gap') {
    const { gap: g } = item;
    return (
      <div className="attention-card type-gap">
        <div className="ac-type gap">Practice opportunity</div>
        <div className="ac-title">{g.tag}</div>
        <div className="ac-sub">
          Peer exposure significantly higher than yours
        </div>
        <div className="ac-meta">
          <span className={`gap-badge ${g.gapLevel}`}>{g.gapLevel} GAP</span>
        </div>
        <div className="ac-footer">
          <span />
          <a href={`https://codeforces.com/problemset?tags=${encodeURIComponent(g.tag)}`} target="_blank" rel="noreferrer" className="btn-link btn-sm" style={{ color: 'var(--purple)', borderColor: 'rgba(188,19,254,0.2)', background: 'rgba(188,19,254,0.07)' }}>
            Practice topic ↗
          </a>
        </div>
      </div>
    );
  }

  if (item.type === 'target') {
    const { target: t } = item;
    return (
      <div className="attention-card type-target">
        <div className="ac-type target">Suggested practice</div>
        <div className="ac-title">{t.relatedTag || 'Practice'}</div>
        <div className="ac-sub">{t.action}</div>
        <div className="ac-meta">{t.reason}</div>
        <div className="ac-footer">
          {t.suggestedRating && <span className="rating-badge">{t.suggestedRating}</span>}
        </div>
      </div>
    );
  }

  return null;
}

// ── Peer Card ──────────────────────────────────────────────
function PeerCard({ rival, journeys, nowSec }) {
  const hasRecent = journeys.some(j => {
    const hoursAgo = (nowSec - (j.lastAt || 0)) / 3600;
    return j.handle === rival.handle && hoursAgo < 48;
  });

  return (
    <Link to={`/friend/${rival.handle}`} className="peer-card">
      <div className="pc-avatar">{rival.handle[0]?.toUpperCase()}</div>
      <div className="pc-body">
        <div className="pc-handle">{rival.handle}</div>
        <div className="pc-sub">
          {rival.rating ? `${rival.rating}` : '—'}
          {rival.rank ? ` · ${rival.rank}` : ''}
        </div>
      </div>
      <div className="pc-right">
        <div className="pc-velocity">{rival.velocity || 0}</div>
        <div className="pc-vel-unit">solves/7d</div>
      </div>
      {hasRecent && <span className="pc-live" title="Active recently" />}
    </Link>
  );
}

// ── Legacy Problem Row ─────────────────────────────────────
function ProblemRow({ p }) {
  return (
    <tr>
      <td>
        <Link to={`/problem/${p.contestId}/${p.index}`} className="p-name">{p.name}</Link>
        <div className="p-tags">{(p.tags || []).join(', ')}</div>
      </td>
      <td className="center-cell"><span className="rating-badge">{p.rating}</span></td>
      <td className="center-cell">
        <div className="rival-list">
          {(p.rivals || []).slice(0, 3).map(r => (
            <Link key={r} to={`/friend/${r}`} className="avatar-small" title={r}>{r[0]?.toUpperCase()}</Link>
          ))}
          {(p.rivals || []).length > 3 && <span className="more-rivals">+{(p.rivals || []).length - 3}</span>}
        </div>
      </td>
      <td className="center-cell">
        <a href={`https://codeforces.com/contest/${p.contestId}/problem/${p.index}`}
           target="_blank" rel="noreferrer" className="deploy-btn">OPEN ↗</a>
      </td>
    </tr>
  );
}

// ── Dashboard ──────────────────────────────────────────────
const POLL_INTERVAL = 30_000;

export default function Dashboard() {
  const [error, setError] = useState('');
  const [analyticsError, setAnalyticsError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [rivals,          setRivals]          = useState([]);
  const [activity,        setActivity]        = useState([]);
  const [skillGaps,       setSkillGaps]       = useState([]);
  const [learningTargets, setLearningTargets] = useState([]);
  const [syncStatus,      setSyncStatus]      = useState(null);
  const [syncing,         setSyncing]         = useState(false);
  const [legacyData,      setLegacyData]      = useState(null);
  const [legacyLoading,   setLegacyLoading]   = useState(false);
  const [lastFetch,       setLastFetch]       = useState(null);
  const [showAllPeers,    setShowAllPeers]    = useState(false);
  const pollRef = useRef(null);

  const fetchCore = useCallback(async () => {
    try {
      const [rivalsRes, activityRes, statusRes] = await Promise.all([
        api.rivals(),
        api.activity(100),
        api.syncStatus(),
      ]);
      setRivals(rivalsRes.rivals || []);
      setActivity(activityRes.activity || []);
      setSyncStatus(statusRes);
      setLastFetch(Date.now());
      setError('');
    } catch (e) {
      setError(e.message || 'Could not load your workspace. Please try refreshing.');
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const [gapsRes, targetsRes] = await Promise.all([
        api.skillGaps(),
        api.learningTargets(),
      ]);
      setSkillGaps(gapsRes.skillGaps || []);
      setLearningTargets(targetsRes.targets || []);
      setAnalyticsError('');
    } catch (e) {
      setAnalyticsError(e.message || 'Practice insights are temporarily unavailable.');
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchCore();
    fetchAnalytics();
  }, [fetchCore, fetchAnalytics]);

  // Polling
  useEffect(() => {
    const poll = () => {
      if (!document.hidden) fetchCore();
    };
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [fetchCore]);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await api.sync();
      // Brief poll to pick up status change
      await new Promise(r => setTimeout(r, 1500));
      await fetchCore();
    } catch (e) {
      setError(e.message || 'Sync could not start. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const loadLegacy = async () => {
    setLegacyLoading(true);
    try {
      setLegacyData(await api.compareAll());
    } catch {
      setError('Problem comparison is temporarily unavailable. Please try again shortly.');
    } finally {
      setLegacyLoading(false);
    }
  };

  const nowSec = useMemo(() => Math.floor(lastFetch / 1000) || 0, [lastFetch]);

  const journeys = groupIntoJourneys(activity);
  const attentionItems = buildAttentionItems(journeys, skillGaps, learningTargets);
  const peersToShow = showAllPeers ? rivals : rivals.slice(0, 10);

  const zoneLabels = {
    newbie:'Newbie', pupil:'Pupil', specialist:'Specialist',
    expert:'Expert', candidateMaster:'Candidate Master',
    master:'Master', intMaster:'Intl Master', grandmaster:'Grandmaster',
  };

  const isSyncing = syncing || syncStatus?.jobRunning;

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div className="page-eyebrow">Your Codeforces workspace</div>
        <h1>Overview</h1>
        <p>Follow your progress, learn from friends, and find your next challenge.</p>
      </div>
      {error && <div className="dashboard-error" role="alert">{error}</div>}
      {analyticsError && <div className="dashboard-error" role="status">Practice insights could not load. <button className="btn btn-subtle" onClick={fetchAnalytics}>Try again</button></div>}
      {initialLoading && <div className="page-loading" role="status"><div className="loading-bar" />Loading your activity…</div>}
      {!initialLoading && <>


      {/* Sync bar */}
      <div className="sync-bar">
        <div className="sync-bar-left">
          <div className="db-status">
            <span className={`status-dot ${isSyncing ? 'syncing' : ''}`} />
            {isSyncing
              ? <span className="sync-running">Syncing your workspace…</span>
              : <span className="sync-summary">
                  {syncStatus?.handles?.filter(h => h.status === 'done').length || 0}
                  / {syncStatus?.handles?.length || 0} handles synced
                </span>
            }
          </div>
        </div>
        <div className="sync-bar-right">
          <button className="btn btn-primary btn-sm" onClick={triggerSync} disabled={isSyncing}>
            {syncing ? 'Starting…' : 'Sync all'}
          </button>
          <button className="btn btn-subtle btn-sm" onClick={fetchCore}>
            Refresh
          </button>
          <button className="btn btn-subtle btn-sm" onClick={loadLegacy} disabled={legacyLoading}>
            {legacyLoading ? 'Loading…' : 'Compare problems'}
          </button>
        </div>
      </div>

      {/* Handle pills (shown when syncing) */}
      {isSyncing && syncStatus?.handles && (
        <div className="sync-handles" style={{ marginBottom: 16 }}>
          {syncStatus.handles.map(h => (
            <span key={h.handle} className={`handle-pill status-${h.status}`} title={h.error || h.status}>
              {h.handle}
            </span>
          ))}
        </div>
      )}

      {/* Intel Strip */}
      <IntelStrip
        rivals={rivals}
        journeys={journeys}
        skillGaps={skillGaps}
        syncStatus={syncStatus}
        lastFetch={lastFetch}
        nowSec={nowSec}
      />

      {/* Attention Queue */}
      {attentionItems.length > 0 && (
        <section className="attention-section">
          <div className="section-row-header">
            <h2>Worth a closer look</h2>
            <span className="section-badge">{attentionItems.length} {attentionItems.length === 1 ? 'item' : 'items'}</span>
          </div>
          <div className="attention-grid">
            {attentionItems.map((item, i) => (
              <AttentionCard key={i} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Main Two-Column */}
      <div className="dashboard-main">
        {/* Left: Your friends */}
        <div className="peer-section-wrap">
          <div className="section-row-header">
            <h2>Your friends</h2>
            <span className="section-badge">{rivals.length} tracked</span>
          </div>
          <div className="peer-cards">
            {rivals.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                No friends to show yet. Add friends in Settings, then sync to see their progress.
              </div>
            ) : (
              peersToShow.map(r => (
                <PeerCard key={r.handle} rival={r} journeys={journeys} nowSec={nowSec} />
              ))
            )}
          </div>
          {rivals.length > 10 && (
            <button className="show-all-peers-btn" onClick={() => setShowAllPeers(v => !v)}>
              {showAllPeers ? `Show fewer` : `Show all ${rivals.length}`}
            </button>
          )}
        </div>

        {/* Right: Grouped Activity Feed */}
        <div className="feed-section-wrap">
          <div className="feed-header-row">
            <h2>Recent activity</h2>
            {lastFetch && (
              <span className="feed-updated">updated {relTime(Math.floor(lastFetch / 1000))}</span>
            )}
          </div>
          <GroupedFeed activity={activity} maxItems={20} showHandle />
        </div>
      </div>

      {/* Training Section */}
      {(skillGaps.length > 0 || learningTargets.length > 0) && (
        <section className="training-section">
          <div className="section-row-header" style={{ marginBottom: 14 }}>
            <h2>Skills &amp; practice</h2>
          </div>
          <div className="training-grid">
            <SkillGapPanel skillGaps={skillGaps} />
            <LearningTargets targets={learningTargets} />
          </div>
        </section>
      )}

      {/* Legacy section */}
      <details className="legacy-section">
        <summary>
          Find practice problems
        </summary>
        <div className="legacy-inner">
          {!legacyData ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <button className="btn btn-ghost" onClick={loadLegacy} disabled={legacyLoading}>
                {legacyLoading ? 'Finding problems…' : 'Find problems'}
              </button>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.62rem', marginTop: 10 }}>
                Find problems your friends have solved that you haven’t tried yet.
              </p>
            </div>
          ) : (
            <>
              <div className="legacy-header">
                <span className="legacy-header-title">Practice problems</span>
                <div className="legacy-stats">
                  <span>My Rating: <strong>{legacyData.me?.rating || '—'}</strong></span>
                  <span>My Solves: <strong>{legacyData.me?.solvedCount || '—'}</strong></span>
                </div>
              </div>
              <div className="bucket-grid">
                {Object.entries(legacyData.categorized || {}).map(([key, problems]) =>
                  problems.length > 0 && (
                    <div key={key} className="bucket-card">
                      <div className={`bucket-title ${key}`}>{zoneLabels[key] || key}</div>
                      <table className="legacy-table">
                        <thead>
                          <tr>
                            <th>Target</th>
                            <th className="center-cell">Rate</th>
                            <th className="center-cell">Peers</th>
                            <th className="center-cell">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {problems.map(p => <ProblemRow key={p.id} p={p} />)}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </details>
      </>}

    </div>
  );
}
