const SIGNALS = {
  HIGH_INDEPENDENT_ATTEMPT_EVIDENCE: { label: 'HIGH INDEPENDENT-ATTEMPT EVIDENCE', color: '#4ade80' },
  MIXED_UNCERTAIN:                    { label: 'MIXED / UNCERTAIN',                  color: '#fb923c' },
  LOW_INDEPENDENT_ATTEMPT_EVIDENCE:  { label: 'LOW INDEPENDENT-ATTEMPT EVIDENCE',   color: '#f87171' },
  INSUFFICIENT_DATA:                  { label: 'INSUFFICIENT DATA',                  color: '#94a3b8' },
};

export default function EvidenceSignal({ signal }) {
  if (!signal) return null;
  const s = SIGNALS[signal.signal] || SIGNALS.INSUFFICIENT_DATA;
  return (
    <div className="evidence-card">
      <div className="evidence-signal-row" style={{ color: s.color, borderColor: s.color + '40', background: s.color + '0a' }}>
        {s.label}
        <span className="evidence-conf">{signal.confidence}</span>
      </div>
      {signal.factors && signal.factors.length > 0 && (
        <ul className="evidence-factors">
          {signal.factors.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}
    </div>
  );
}
