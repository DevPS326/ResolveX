const VERDICT_STYLES = {
  OK:                   { label: 'AC',   color: '#4ade80' },
  WRONG_ANSWER:         { label: 'WA',   color: '#f87171' },
  TIME_LIMIT_EXCEEDED:  { label: 'TLE',  color: '#fb923c' },
  RUNTIME_ERROR:        { label: 'RE',   color: '#c084fc' },
  COMPILATION_ERROR:    { label: 'CE',   color: '#94a3b8' },
  MEMORY_LIMIT_EXCEEDED:{ label: 'MLE',  color: '#f59e0b' },
  IDLENESS_LIMIT_EXCEEDED:{ label:'ILE', color: '#f59e0b' },
  SKIPPED:              { label: 'SKP',  color: '#64748b' },
  UNKNOWN:              { label: '???',  color: '#64748b' },
};

export default function VerdictBadge({ verdict }) {
  const s = VERDICT_STYLES[verdict] || VERDICT_STYLES.UNKNOWN;
  return (
    <span style={{
      background: s.color + '22',
      color: s.color,
      border: `1px solid ${s.color}66`,
      borderRadius: 3,
      padding: '2px 7px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      fontFamily: 'monospace'
    }}>
      {s.label}
    </span>
  );
}
