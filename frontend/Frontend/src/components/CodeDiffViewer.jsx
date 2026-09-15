import { useState } from 'react';
import { api } from '../services/api';

export default function CodeDiffViewer({ id1, id2, label1, label2 }) {
  const [state, setState] = useState({ diff: null, loading: false, error: null });

  const loadDiff = async () => {
    setState({ diff: null, loading: true, error: null });
    try {
      const res = await api.submissionDiff(id1, id2);
      if (res.error) setState({ diff: null, loading: false, error: res.error });
      else setState({ diff: res, loading: false, error: null });
    } catch (e) {
      setState({ diff: null, loading: false, error: e.message });
    }
  };

  if (!state.diff && !state.loading && !state.error) {
    return (
      <button className="btn neon-btn-sm" onClick={loadDiff}>
        Diff #{id1} → #{id2}
      </button>
    );
  }

  if (state.loading) return <div className="loading-sm">Computing diff...</div>;
  if (state.error) return <div className="error-sm">Diff unavailable: {state.error}</div>;

  const { diff } = state;
  return (
    <div className="diff-viewer">
      <div className="diff-header">
        <span className="diff-label">{label1 || `#${id1}`} → {label2 || `#${id2}`}</span>
        {diff.identical ? (
          <span style={{ color: '#94a3b8' }}>Identical</span>
        ) : (
          <>
            <span style={{ color: '#4ade80' }}>+{diff.additions}</span>
            <span style={{ color: '#f87171', marginLeft: 8 }}>-{diff.deletions}</span>
            <span style={{ color: '#94a3b8', marginLeft: 8 }}>{diff.changed} lines changed</span>
          </>
        )}
      </div>
      {!diff.identical && (
        <pre className="diff-patch">{diff.patch}</pre>
      )}
    </div>
  );
}
