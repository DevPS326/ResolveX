import { Link } from 'react-router-dom';
import VerdictBadge from './VerdictBadge';

const formatRelTime = (sec) => {
  if (!sec) return '—';
  const diff = Math.floor(Date.now() / 1000) - sec;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function ActivityFeed({ activity }) {
  if (!activity || activity.length === 0) {
    return <div className="empty-state">No activity yet. Run a sync to populate.</div>;
  }

  return (
    <div className="activity-feed">
      {activity.slice(0, 20).map(item => (
        <div key={item.submissionId} className="activity-item">
          <Link to={`/friend/${item.handle}`} className="activity-handle">{item.handle}</Link>
          <VerdictBadge verdict={item.verdict} />
          {item.contestId && item.problemIndex ? (
            <Link
              to={`/problem/${item.contestId}/${item.problemIndex}`}
              className="activity-problem"
            >
              {item.problemName || `${item.contestId}${item.problemIndex}`}
            </Link>
          ) : (
            <span className="activity-problem">{item.problemName || '—'}</span>
          )}
          {item.problemRating && <span className="activity-rating">{item.problemRating}</span>}
          <span className="activity-time">{formatRelTime(item.creationTimeSeconds)}</span>
        </div>
      ))}
    </div>
  );
}
