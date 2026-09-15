import { Link } from 'react-router-dom';
import VerdictBadge from './VerdictBadge';
import { groupIntoJourneys } from '../utils/groupActivity';

const formatRelTime = (sec) => {
  if (!sec) return '—';
  const diff = Math.floor(Date.now() / 1000) - sec;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const formatDuration = (secs) => {
  if (!secs || secs < 60) return null;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
};

export default function GroupedFeed({ activity, maxItems = 18, showHandle = true }) {
  if (!activity || activity.length === 0) {
    return <div className="empty-state">No activity yet — run a sync to populate.</div>;
  }

  const journeys = groupIntoJourneys(activity).slice(0, maxItems);

  if (journeys.length === 0) {
    return <div className="empty-state">No grouped journeys found.</div>;
  }

  return (
    <div className="journey-cards">
      {journeys.map((j, idx) => {
        const dur = formatDuration(j.duration);
        const isInteresting = j.attemptCount >= 3 && j.solved;
        return (
          <div key={j.key} className="journey-card" style={{ animationDelay: `${idx * 30}ms` }}>
            <div className="jc-main">
              <div className="jc-top">
                {showHandle && (
                  <Link to={`/friend/${j.handle}`} className="jc-handle">{j.handle}</Link>
                )}
                <Link
                  to={`/problem/${j.contestId}/${j.problemIndex}`}
                  className="jc-problem"
                  title={j.problemName}
                >
                  {j.contestId}{j.problemIndex}
                  {j.problemName ? ` — ${j.problemName}` : ''}
                </Link>
                {j.problemRating && <span className="rating-badge">{j.problemRating}</span>}
              </div>

              <div className="jc-verdicts">
                {j.verdicts.map((v, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    {i > 0 && <span className="verdict-sep">→</span>}
                    <VerdictBadge verdict={v} />
                  </span>
                ))}
              </div>

              <div className="jc-meta">
                <span className="jc-meta-hi">{j.attemptCount} attempt{j.attemptCount !== 1 ? 's' : ''}</span>
                {dur && <span className="jc-meta-hi">{dur}</span>}
                {!j.solved && <span style={{ color: 'var(--text-muted)' }}>unsolved</span>}
                {isInteresting && <span style={{ color: 'var(--green)', fontSize: '0.56rem' }}>★ interesting journey</span>}
              </div>
            </div>

            <div className="jc-side">
              <span className="jc-time">{formatRelTime(j.lastAt)}</span>
              <Link
                to={`/problem/${j.contestId}/${j.problemIndex}`}
                className="btn-link btn-sm"
              >
                {j.attemptCount > 1 ? 'VIEW JOURNEY' : 'INSPECT'}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
