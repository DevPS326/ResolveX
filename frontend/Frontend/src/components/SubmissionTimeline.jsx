import VerdictBadge from './VerdictBadge';

const formatTime = (seconds) => {
  if (!seconds) return '—';
  const d = new Date(seconds * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined) return null;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

export default function SubmissionTimeline({ timeline, onSelectSubmission, selectedId }) {
  if (!timeline || timeline.attemptCount === 0) {
    return <div className="empty-state">No attempts recorded.</div>;
  }

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <span className="timeline-count">{timeline.attemptCount} attempt{timeline.attemptCount > 1 ? 's' : ''}</span>
        {timeline.solved && timeline.solvingDuration !== null && (
          <span className="timeline-duration">{formatDuration(timeline.solvingDuration)} to AC</span>
        )}
        {!timeline.solved && <span className="timeline-unsolved">Unsolved</span>}
      </div>

      <div className="verdict-sequence">
        {timeline.verdictSequence.map((v, i) => (
          <span key={i} style={{ marginRight: 4 }}>
            <VerdictBadge verdict={v} />
          </span>
        ))}
      </div>

      <div className="timeline-entries">
        {timeline.submissions.map((sub, i) => (
          <div
            key={sub.submissionId}
            className={`timeline-entry ${selectedId === sub.submissionId ? 'selected' : ''}`}
            onClick={() => onSelectSubmission && onSelectSubmission(sub)}
          >
            <span className="entry-num">#{i + 1}</span>
            <VerdictBadge verdict={sub.verdict} />
            <span className="entry-time">{formatTime(sub.creationTimeSeconds)}</span>
            <span className="entry-lang">{sub.programmingLanguage || '—'}</span>
            {onSelectSubmission && (
              <span className="entry-source-hint">
                {sub.sourceAvailable ? '[src]' : '[req src]'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
