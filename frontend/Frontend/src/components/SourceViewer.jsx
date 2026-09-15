import { useState } from 'react';
import { api } from '../services/api';

export default function SourceViewer({ submission }) {
  const [state, setState] = useState({ status: null, source: null, loading: false, error: null });

  const fetchSource = async () => {
    setState(s => ({ ...s, loading: true }));
    try {
      const res = await api.submissionSource(submission.submissionId);
      setState({ status: res.fetchStatus, source: res.source, loading: false, error: res.fetchError });
    } catch (e) {
      setState({ status: 'ERROR', source: null, loading: false, error: e.message });
    }
  };

  const { status, source, loading } = state;
  const cfUrl = submission.submissionUrl;

  return (
    <div className="source-viewer">
      <div className="source-toolbar">
        <span className="source-meta">
          Sub #{submission.submissionId} · {submission.programmingLanguage || 'Unknown'}
        </span>
        {!status && !loading && (
          <button className="btn btn-ghost btn-sm" onClick={fetchSource}>
            FETCH SOURCE
          </button>
        )}
        {loading && <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>Fetching…</span>}
        {cfUrl && (
          <a href={cfUrl} target="_blank" rel="noreferrer" className="btn-link btn-sm">
            VIEW ON CF ↗
          </a>
        )}
      </div>

      {status === 'SUCCESS' && source && (
        <pre className="source-code-block">{source}</pre>
      )}

      {status && status !== 'SUCCESS' && (
        <div className="source-blocked-card">
          {status === 'BLOCKED' && (
            <>
              <div className="source-blocked-title">SOURCE UNAVAILABLE AUTOMATICALLY</div>
              <div className="source-blocked-reason">
                Codeforces blocked automated retrieval (Cloudflare protection).
              </div>
              {cfUrl && (
                <a href={cfUrl} target="_blank" rel="noreferrer" className="btn-link btn-sm">
                  OPEN SUBMISSION ON CODEFORCES ↗
                </a>
              )}
            </>
          )}
          {status === 'NOT_AVAILABLE' && (
            <>
              <div className="source-blocked-title">SOURCE NOT PUBLICLY AVAILABLE</div>
              <div className="source-blocked-reason">
                This submission is not accessible via public Codeforces pages.
              </div>
              {cfUrl && <a href={cfUrl} target="_blank" rel="noreferrer" className="btn-link btn-sm">OPEN ON CF ↗</a>}
            </>
          )}
          {status === 'PARSE_ERROR' && (
            <>
              <div className="source-blocked-title">COULD NOT PARSE SOURCE</div>
              <div className="source-blocked-reason">Page retrieved but source element not found.</div>
              {cfUrl && <a href={cfUrl} target="_blank" rel="noreferrer" className="btn-link btn-sm">VIEW MANUALLY ↗</a>}
            </>
          )}
          {(status === 'ERROR' || status === 'PENDING') && status !== 'BLOCKED' && status !== 'NOT_AVAILABLE' && status !== 'PARSE_ERROR' && (
            <>
              <div className="source-blocked-title">FETCH ERROR</div>
              <div className="source-blocked-reason">{state.error || 'Unknown error during source retrieval.'}</div>
              <button className="btn btn-subtle btn-sm" onClick={fetchSource}>RETRY</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
