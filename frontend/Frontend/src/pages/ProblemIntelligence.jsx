import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import SourceViewer from '../components/SourceViewer';
import CodeDiffViewer from '../components/CodeDiffViewer';
import EvidenceSignal from '../components/EvidenceSignal';
import VerdictBadge from '../components/VerdictBadge';

const fmtTime = (sec) => {
  if (!sec) return '—';
  return new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fmtDur = (sec) => {
  if (!sec || sec < 60) return null;
  return sec < 3600 ? `${Math.floor(sec / 60)}m` : `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
};

// Short label for verdict
const verdictClass = (v) => ({
  OK: 'AC', WRONG_ANSWER: 'WA', TIME_LIMIT_EXCEEDED: 'TLE',
  MEMORY_LIMIT_EXCEEDED: 'MLE', RUNTIME_ERROR: 'RE', COMPILATION_ERROR: 'CE',
}[v] || 'CE');

// Horizontal timeline node component
function HorizTimeline({ submissions, onSelect, selectedId }) {
  return (
    <div className="horiz-timeline">
      {submissions.map((sub, i) => {
        const vc = verdictClass(sub.verdict);
        return (
          <div key={sub.submissionId} className="ht-step">
            {i > 0 && <div className="ht-connector" />}
            <div className="ht-node">
              <button
                type="button"
                aria-pressed={selectedId === sub.submissionId}
                className={`ht-dot ${vc} ${selectedId === sub.submissionId ? 'selected' : ''}`}
                onClick={() => onSelect?.(sub)}
                title={`${sub.verdict} · ${fmtTime(sub.creationTimeSeconds)}`}
              >
                {vc}
              </button>
              <div className="ht-time">{fmtTime(sub.creationTimeSeconds)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProblemIntelligence() {
  const { contestId, index } = useParams();
  const [data,            setData]            = useState(null);
  const [editorial,       setEditorial]       = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [selectedFriend,  setSelectedFriend]  = useState(null);
  const [selectedSub,     setSelectedSub]     = useState(null);
  const [evidence,        setEvidence]        = useState({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const [pd, ed] = await Promise.all([
          api.problemFriends(contestId, index),
          api.editorial(contestId).catch(() => null),
        ]);
        if (cancelled) return;
        setData(pd);
        setEditorial(ed);
        if (pd.friends?.length > 0) {
          setSelectedFriend(pd.friends[0]);
          loadEvidence(pd.friends[0].handle, pd.friends[0]);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId, index]);

  const loadEvidence = async (handle) => {
    if (evidence[handle] !== undefined) return;
    try {
      const res = await api.evidenceSignal(contestId, index, handle);
      setEvidence(prev => ({ ...prev, [handle]: res }));
    } catch {
      setEvidence(prev => ({ ...prev, [handle]: null }));
    }
  };

  const selectFriend = (f) => {
    setSelectedFriend(f);
    setSelectedSub(null);
    loadEvidence(f.handle);
  };

  if (loading) return (
    <div className="page-loading">
      Loading problem details…
      <div className="loading-bar" />
    </div>
  );
  if (error) return <div className="page-error">Error: {error}</div>;
  if (!data)  return null;

  const { problem, friends } = data;

  const cfProblemUrl  = `https://codeforces.com/contest/${contestId}/problem/${index}`;
  const cfContestUrl  = `https://codeforces.com/contest/${contestId}`;
  const dur           = fmtDur(selectedFriend?.solvingDuration);
  const ev            = evidence[selectedFriend?.handle];

  return (
    <div className="problem-intelligence">

      {/* Header */}
      <div className="pi-header">
        <div className="pi-breadcrumb">
          <Link to="/">← Overview</Link>
          {' / '}Problem Intelligence
        </div>
        <div className="pi-title-row">
          <div>
            <div className="pi-problem-id">{contestId} · {index}</div>
            <h1 className="pi-title">{problem?.name || 'Unknown Problem'}</h1>
          </div>
          <div className="pi-actions">
            <a href={cfProblemUrl}  target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Open problem ↗</a>
            <a href={cfContestUrl}  target="_blank" rel="noreferrer" className="btn btn-subtle btn-sm">View contest ↗</a>
          </div>
        </div>
        <div className="pi-meta">
          {problem?.rating && <span className="rating-badge">{problem.rating}</span>}
          {(problem?.tags || []).map(t => <span key={t} className="tag-pill">{t}</span>)}
        </div>
      </div>

      {/* Editorial banner */}
      {editorial && (
        <div className="editorial-banner">
          {editorial.editorialAvailable ? (
            <>
              <div className="editorial-avail">
                <span style={{ color: 'var(--green)' }}>●</span>
                Editorial
                {editorial.availableAt && (
                  <span className="editorial-time"> · Available: {new Date(editorial.availableAt).toLocaleString()}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {editorial.title && <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{editorial.title}</span>}
                {editorial.editorialUrl && (
                  <a href={editorial.editorialUrl} target="_blank" rel="noreferrer" className="btn-link btn-sm">Read editorial ↗</a>
                )}
              </div>
            </>
          ) : (
            <span className="editorial-none">
              No editorial is available for this contest yet.
            </span>
          )}
        </div>
      )}

      {/* Main layout */}
      <div className="pi-layout">

        {/* Friends sidebar */}
        <div className="pi-friends-sidebar">
          <div className="pi-sidebar-header">
            Friends’ attempts ({friends.length})
          </div>

          {friends.length === 0 ? (
            <div className="empty-state">No tracked peer has attempted this problem.</div>
          ) : (
            friends.map(f => (
              <div
                key={f.handle}
                className={`friend-entry ${selectedFriend?.handle === f.handle ? 'selected' : ''}`}
                tabIndex={0}
                aria-label={`Show attempts by ${f.handle}`}
                onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectFriend(f); } }}
                onClick={() => selectFriend(f)}
              >
                <div className="fe-top">
                  <Link
                    to={`/friend/${f.handle}`}
                    className="fe-handle"
                    onClick={e => e.stopPropagation()}
                  >
                    {f.handle}
                  </Link>
                  <span className={f.solved ? 'fe-solved' : 'fe-unsolved'}>
                    {f.solved ? 'Solved' : 'Unsolved'}
                  </span>
                </div>
                <div className="fe-verdicts">
                  {f.verdictSequence.map((v, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      {i > 0 && <span className="verdict-sep" style={{ fontSize: '0.52rem', color: 'var(--text-muted)' }}>→</span>}
                      <VerdictBadge verdict={v} />
                    </span>
                  ))}
                </div>
                <div className="fe-meta">
                  <span>{f.attemptCount} attempt{f.attemptCount !== 1 ? 's' : ''}</span>
                  {f.solved && f.solvingDuration !== null && (
                    <span>{fmtDur(f.solvingDuration) || '<1m'}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail panel */}
        {selectedFriend && (
          <div className="pi-detail">

            {/* Timeline */}
            <div className="pi-panel">
              <div className="pi-panel-header">
                <span>
                  Attempts ·{' '}
                  <Link to={`/friend/${selectedFriend.handle}`} style={{ color: 'var(--cyan)' }}>
                    {selectedFriend.handle}
                  </Link>
                </span>
                <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {selectedFriend.solved && dur && (
                    <span style={{ color: 'var(--green)' }}>{dur} to AC</span>
                  )}
                  {!selectedFriend.solved && (
                    <span style={{ color: 'var(--text-muted)' }}>Unsolved</span>
                  )}
                  <a
                    href={`https://codeforces.com/submissions/${selectedFriend.handle}`}
                    target="_blank" rel="noreferrer"
                    className="btn-link btn-sm"
                  >
                    All submissions ↗
                  </a>
                </span>
              </div>
              <div className="pi-panel-body">
                <HorizTimeline
                  submissions={selectedFriend.submissions || []}
                  onSelect={setSelectedSub}
                  selectedId={selectedSub?.submissionId}
                />

                {/* Submission list */}
                <div className="submission-list">
                  {(selectedFriend.submissions || []).map((sub, i) => (
                    <div
                      key={sub.submissionId}
                      className={`sub-entry ${selectedSub?.submissionId === sub.submissionId ? 'selected' : ''}`}
                      tabIndex={0}
                      aria-label={`View submission ${i + 1}`}
                      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelectedSub(sub); } }}
                      onClick={() => setSelectedSub(sub)}
                    >
                      <span className="se-num">#{i + 1}</span>
                      <VerdictBadge verdict={sub.verdict} />
                      <span className="se-time">{fmtTime(sub.creationTimeSeconds)}</span>
                      <span className="se-lang">{sub.programmingLanguage || '—'}</span>
                      <a
                        href={sub.submissionUrl}
                        target="_blank" rel="noreferrer"
                        className="btn-link btn-sm"
                        onClick={e => e.stopPropagation()}
                      >
                        CF ↗
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Evidence signal */}
            {ev !== undefined && ev !== null && (
              <div className="pi-panel">
                <div className="pi-panel-header">Attempt analysis</div>
                <EvidenceSignal signal={ev} />
              </div>
            )}

            {/* Source viewer for selected sub */}
            {selectedSub && (
              <div className="pi-panel">
                <div className="pi-panel-header">
                  Source · Attempt #{(selectedFriend.submissions || []).findIndex(s => s.submissionId === selectedSub.submissionId) + 1}
                </div>
                <SourceViewer submission={selectedSub} />
              </div>
            )}

            {/* Code evolution diff pairs */}
            {selectedFriend.submissions && selectedFriend.submissions.length >= 2 && (
              <div className="pi-panel">
                <div className="pi-panel-header">Code changes</div>
                <div className="pi-panel-body">
                  <div className="diff-pairs">
                    {selectedFriend.submissions.slice(0, -1).map((sub, i) => {
                      const next = selectedFriend.submissions[i + 1];
                      return (
                        <CodeDiffViewer
                          key={`${sub.submissionId}-${next.submissionId}`}
                          id1={sub.submissionId}
                          id2={next.submissionId}
                          label1={`Attempt ${i + 1} (${sub.verdict})`}
                          label2={`Attempt ${i + 2} (${next.verdict})`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
