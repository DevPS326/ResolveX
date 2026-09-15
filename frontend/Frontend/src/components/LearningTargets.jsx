export default function LearningTargets({ targets }) {
  if (!targets || targets.length === 0) {
    return (
      <div className="training-queue">
        <h2>Today's Training</h2>
        <div className="empty-state">No training targets yet — sync and run analytics.</div>
      </div>
    );
  }

  const showing = targets.slice(0, 5);

  return (
    <div className="training-queue">
      <h2>Today's Training</h2>
      <div className="training-items">
        {showing.map((t, i) => (
          <div key={i} className="training-item">
            <div className="ti-priority">Priority {i + 1}</div>
            <div className="ti-title">{t.relatedTag || 'Practice'}</div>
            <div className="ti-reason">{t.action}</div>
            {t.reason && (
              <div className="ti-reason" style={{ color: 'var(--text-muted)', fontSize: '0.58rem', marginTop: -6 }}>
                {t.reason}
              </div>
            )}
            <div className="ti-footer">
              {t.suggestedRating ? (
                <span className="ti-rating">Suggested difficulty: {t.suggestedRating}</span>
              ) : <span />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
