// API base URL is empty in local dev (Vite proxy handles /api),
// and can be set to the deployed backend in production via VITE_API_URL.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const url = (path) => `${API_BASE}${path}`;

export const api = {
  get: (path) => fetch(url(path)).then(r => r.json()),
  post: (path, body = {}) => fetch(url(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json()),

  // Specific endpoints
  sync:         () => api.post('/api/sync'),
  syncStatus:   () => api.get('/api/sync/status'),
  rivals:       () => api.get('/api/rivals'),
  activity:     (limit = 50) => api.get(`/api/activity?limit=${limit}`),

  problemFriends: (contestId, index) =>
    api.get(`/api/problems/${contestId}/${index}/friends`),

  friendSubmissions: (handle, contestId, index) =>
    api.get(`/api/friends/${handle}/problems/${contestId}/${index}/submissions`),

  submissionSource: (submissionId) =>
    api.get(`/api/submissions/${submissionId}/source`),

  submissionDiff: (id1, id2) =>
    api.get(`/api/submissions/diff/${id1}/${id2}`),

  editorial: (contestId) =>
    api.get(`/api/editorials/${contestId}`),

  skillGaps:       () => api.get('/api/analytics/skills'),
  learningTargets: () => api.get('/api/analytics/learning'),
  friendFingerprint: (handle) => api.get(`/api/analytics/friends/${handle}`),

  evidenceSignal: (contestId, index, handle) =>
    api.get(`/api/analytics/problems/${contestId}/${index}/evidence/${handle}`),

  compareAll: () => api.get('/compare-all'),
};
