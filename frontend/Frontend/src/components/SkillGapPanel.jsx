import { Link } from 'react-router-dom';

const LEVEL_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };

export default function SkillGapPanel({ skillGaps }) {
  if (!skillGaps || skillGaps.length === 0) {
    return (
      <div className="gap-section">
        <h2>Skill Gaps</h2>
        <div className="empty-state">No gap data yet — sync and run analytics.</div>
      </div>
    );
  }

  const gaps = skillGaps
    .filter(g => g.gapLevel !== 'NONE')
    .sort((a, b) => (LEVEL_ORDER[a.gapLevel] ?? 3) - (LEVEL_ORDER[b.gapLevel] ?? 3))
    .slice(0, 5);

  if (gaps.length === 0) {
    return (
      <div className="gap-section">
        <h2>Skill Gaps</h2>
        <div className="empty-state">No significant gaps detected.</div>
      </div>
    );
  }

  const myMax   = Math.max(...gaps.map(g => g.myScore || 0), 0.001);
  const peerMax = Math.max(...gaps.map(g => g.peerAvgScore || 0), 0.001);
  const absMax  = Math.max(myMax, peerMax);

  return (
    <div className="gap-section">
      <h2>Skill Gaps</h2>
      <div className="gap-cards">
        {gaps.map(g => {
          const myPct   = Math.min((g.myScore || 0) / absMax * 100, 100);
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
                  <span className="gap-bar-count">{(g.myScore * 100).toFixed(0)}%</span>
                </div>
                <div className="gap-bar-row">
                  <span className="gap-bar-label">Peers</span>
                  <div className="gap-bar-track">
                    <div className="gap-bar-fill gap-bar-peer" style={{ width: `${peerPct}%` }} />
                  </div>
                  <span className="gap-bar-count">{(g.peerAvgScore * 100).toFixed(0)}%</span>
                </div>
              </div>

              <div className="gap-context">
                <span><span className="dot-me" /> my exposure</span>
                <span><span className="dot-peer" /> peer avg</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
