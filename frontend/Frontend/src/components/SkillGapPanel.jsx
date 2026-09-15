const LEVEL_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };

function evidenceLabel(evidence) {
  if (!evidence) return 'no rated evidence';
  if (evidence.comparisonRating) return `benchmark ${evidence.comparisonRating}`;
  if (evidence.q75Rating) return `q75 ${evidence.q75Rating}`;
  return `${evidence.solvedCount || 0} solves`;
}

export default function SkillGapPanel({ skillGaps }) {
  if (!skillGaps || skillGaps.length === 0) {
    return (
      <div className="gap-section">
        <h2>Skill Gaps</h2>
        <div className="empty-state">No high-confidence peer-backed gaps right now.</div>
      </div>
    );
  }

  const gaps = skillGaps
    .filter(g => g.actionable !== false && (g.gapLevel === 'HIGH' || g.gapLevel === 'MEDIUM'))
    .sort((a, b) => (LEVEL_ORDER[a.gapLevel] ?? 3) - (LEVEL_ORDER[b.gapLevel] ?? 3))
    .slice(0, 5);

  if (gaps.length === 0) {
    return (
      <div className="gap-section">
        <h2>Skill Gaps</h2>
        <div className="empty-state">No high-confidence peer-backed gaps right now.</div>
      </div>
    );
  }

  const absMax = Math.max(
    ...gaps.flatMap(g => [g.myScore || 0, g.peerAvgScore || 0]),
    0.001
  );

  return (
    <div className="gap-section">
      <h2>Skill Gaps</h2>
      <div className="gap-cards">
        {gaps.map(g => {
          const myPct = Math.min((g.myScore || 0) / absMax * 100, 100);
          const peerPct = Math.min((g.peerAvgScore || 0) / absMax * 100, 100);
          return (
            <div key={g.tag} className="gap-card">
              <div className="gap-card-header">
                <span className="gap-tag-name">{g.tag}</span>
                <span className={`gap-badge ${g.gapLevel}`}>{g.gapLevel}</span>
              </div>

              <div className="gap-bars">
                <div className="gap-bar-row">
                  <span className="gap-bar-label">Me</span>
                  <div className="gap-bar-track">
                    <div className="gap-bar-fill gap-bar-me" style={{ width: `${myPct}%` }} />
                  </div>
                  <span className="gap-bar-count">{evidenceLabel(g.myEvidence)}</span>
                </div>
                <div className="gap-bar-row">
                  <span className="gap-bar-label">Peer</span>
                  <div className="gap-bar-track">
                    <div className="gap-bar-fill gap-bar-peer" style={{ width: `${peerPct}%` }} />
                  </div>
                  <span className="gap-bar-count">{evidenceLabel(g.peerEvidence)}</span>
                </div>
              </div>

              <div className="gap-context">
                <span><span className="dot-me" /> {g.myEvidence?.solvedCount || 0} solves</span>
                <span><span className="dot-peer" /> {g.benchmarkPeer || 'peer'} · {g.peerEvidence?.solvedCount || 0} solves</span>
              </div>
              {g.reason && (
                <div className="gap-context" style={{ display: 'block', marginTop: 8 }}>
                  {g.reason} {g.confidence ? `(${g.confidence.toLowerCase()} confidence)` : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
