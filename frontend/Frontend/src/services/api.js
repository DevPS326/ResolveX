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
    const error = new Error(message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

// Same-origin proxies keep the account cookie first-party on Vercel and in development.
async function request(path, method = 'GET', body) {
  try {
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-ResolveX-Client': 'web' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    return await parseJsonResponse(response);
  } catch (error) {
    if (error.status === 401 && !path.startsWith('/api/auth/')) window.dispatchEvent(new Event('resolvex:session-expired'));
    throw error;
  }
}
export const api = {
  get: path => request(path),
  post: (path, body = {}) => request(path, 'POST', body),
  put: (path, body = {}) => request(path, 'PUT', body),
  currentAccount: () => request('/api/auth/me'),
  signIn: credentials => request('/api/auth/login', 'POST', credentials),
  register: credentials => request('/api/auth/register', 'POST', credentials),
  signOut: () => request('/api/auth/logout', 'POST', {}),

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
