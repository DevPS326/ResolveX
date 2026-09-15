// Local dev uses Vite proxy. Production falls back to the deployed Render API
// so the app still works even if VITE_API_URL was not injected into a build.
const PROD_API_FALLBACK = 'https://resolvex-api-gw5y.onrender.com';
const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? PROD_API_FALLBACK : '')
).replace(/\/$/, '');

const url = (path) => `${API_BASE}${path}`;

async function parseJsonResponse(response) {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || text;
    } catch {
      // keep raw text
    }
    throw new Error(message || `API ${response.status}`);
  }
  return response.json();
}

export const api = {
  get: (path) => fetch(url(path)).then(parseJsonResponse),
  post: (path, body = {}) => fetch(url(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(parseJsonResponse),
  put: (path, body = {}) => fetch(url(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(parseJsonResponse),

  getConfig:    () => api.get('/api/config'),
  saveConfig:   (config) => api.put('/api/config', config),

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
