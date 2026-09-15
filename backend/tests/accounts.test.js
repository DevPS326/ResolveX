const mockAccounts = new Map();
const mockSessions = new Map();
const mockConfigs = new Map([['primary', { meHandle: 'legacy-owner', friends: ['legacy-friend'] }]]);
let mockNextId = 1;
const mockQuery = value => ({ lean: async () => value, select: () => mockQuery(value) });
jest.mock('../models/Account', () => ({
  create: jest.fn(async doc => {
    if ([...mockAccounts.values()].some(a => a.email === doc.email)) throw Object.assign(new Error('duplicate'), { code: 11000 });
    const account = { ...doc, _id: String(mockNextId++).padStart(24, '0') }; mockAccounts.set(account._id, account); return account;
  }),
  findOne: jest.fn(({ email }) => mockQuery([...mockAccounts.values()].find(a => a.email === email))),
  findById: jest.fn(id => mockQuery(mockAccounts.get(String(id))))
}));
jest.mock('../models/Session', () => ({
  create: jest.fn(async doc => { mockSessions.set(doc.tokenHash, doc); return doc; }),
  findOne: jest.fn(q => { const s = mockSessions.get(q.tokenHash); return mockQuery(s && s.expiresAt > q.expiresAt.$gt ? s : null); }),
  deleteOne: jest.fn(async q => mockSessions.delete(q.tokenHash))
}));
jest.mock('../models/AuthAttempt', () => ({ findOneAndUpdate: jest.fn(async () => ({ count: 1 })) }));
jest.mock('../models/TrackerConfig', () => ({
  findOne: jest.fn(q => mockQuery(mockConfigs.get(q.key))),
  findOneAndUpdate: jest.fn(async (q, update) => { mockConfigs.set(q.key, update.$set); return update.$set; })
}));
jest.mock('../services/codeforcesService', () => ({ getUserInfo: jest.fn(async handles => handles.map(handle => ({ handle }))) }));
jest.mock('../services/syncService', () => ({ syncAll: jest.fn(async () => []), getSyncStatus: jest.fn(async () => []) }));
jest.mock('../services/skillGapService', () => ({ computeSkillGaps: jest.fn(async () => []), generateLearningTargets: jest.fn(async () => []) }));
jest.mock('../models/Submission', () => ({
  find: jest.fn(() => ({ sort: () => ({ limit: () => mockQuery([]), lean: async () => [] }) })),
  aggregate: jest.fn(async () => [])
}));
jest.mock('../models/User', () => ({ find: jest.fn(() => mockQuery([])) }));
const app = require('../app');
const AuthAttempt = require('../models/AuthAttempt');
const Submission = require('../models/Submission');
const { hashPassword, verifyPassword } = require('../services/authService');
const { getTrackerConfig } = require('../services/trackerConfigService');
let server, base;
async function call(path, { method = 'GET', cookie, body, origin = 'https://resolvex-eight.vercel.app', client = 'web' } = {}) {
 const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-ResolveX-Client': client, Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
 return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0], headers: res.headers };
}
beforeAll(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
test('password hashes have independent salts and reject incorrect passwords', async () => {
 const a = await hashPassword('long-test-password'); const b = await hashPassword('long-test-password');
 expect(a).not.toBe(b); expect(a).not.toContain('long-test-password');
 expect(await verifyPassword('long-test-password', a)).toBe(true);
 expect(await verifyPassword('wrong', a)).toBe(false);
});
test('anonymous callers cannot read or overwrite any shared tracker endpoints', async () => {
 for (const path of ['/api/config', '/api/activity', '/api/rivals', '/api/analytics/skills', '/api/analytics/learning', '/api/problems/2256/B/friends', '/api/sync/status', '/compare-all']) expect((await call(path)).status).toBe(401);
 expect((await call('/api/config', { method: 'PUT', body: { meHandle: 'attacker' } })).status).toBe(401);
 await expect(getTrackerConfig()).rejects.toThrow('authenticated account');
});
test('two mockAccounts stay isolated, a second device restores its workspace, logout revokes only its session', async () => {
 const credentialsA = { email: 'Alice@example.com', password: 'a-secure-test-password' };
 const a = await call('/api/auth/register', { method: 'POST', body: credentialsA });
 const b = await call('/api/auth/register', { method: 'POST', body: { email: 'bob@example.com', password: 'b-secure-test-password' } });
 expect(a.status).toBe(201); expect(b.status).toBe(201); expect(a.cookie).not.toBe(b.cookie);
 expect(a.headers.get('set-cookie')).toContain('HttpOnly'); expect(a.headers.get('set-cookie')).toContain('SameSite=Lax');
 expect(a.body.account).toEqual({ email: 'alice@example.com' });
 expect((await call('/api/config', { cookie: a.cookie })).body).toMatchObject({ configured: false, friends: [] });
 expect((await call('/api/config', { cookie: b.cookie })).body).toMatchObject({ configured: false, friends: [] });
 expect((await call('/api/config', { method: 'PUT', cookie: a.cookie, body: { meHandle: 'aliceCF', friends: ['friendA'], accountId: b.body.account.id, key: 'primary' } })).status).toBe(200);
 await call('/api/config', { method: 'PUT', cookie: b.cookie, body: { meHandle: 'bobCF', friends: ['friendB'] } });
 expect((await call('/api/config', { cookie: a.cookie })).body).toMatchObject({ meHandle: 'aliceCF', friends: ['friendA'] });
 expect((await call('/api/config', { cookie: b.cookie })).body).toMatchObject({ meHandle: 'bobCF', friends: ['friendB'] });
 expect(mockConfigs.get('primary').meHandle).toBe('legacy-owner');
 await call('/api/activity', { cookie: a.cookie });
 expect(Submission.find).toHaveBeenLastCalledWith({ handle: { $in: ['aliceCF', 'friendA'] } });
 await call('/api/activity', { cookie: b.cookie });
 expect(Submission.find).toHaveBeenLastCalledWith({ handle: { $in: ['bobCF', 'friendB'] } });
 const device2 = await call('/api/auth/login', { method: 'POST', body: credentialsA });
 expect(device2.status).toBe(200); expect(device2.cookie).not.toBe(a.cookie);
 expect((await call('/api/config', { cookie: device2.cookie })).body.meHandle).toBe('aliceCF');
 const wrong = await call('/api/auth/login', { method: 'POST', body: { ...credentialsA, password: 'wrong' } });
 expect(wrong.status).toBe(401);
 const duplicate = await call('/api/auth/register', { method: 'POST', body: credentialsA }); expect(duplicate.status).toBe(409);
 const logout = await call('/api/auth/logout', { method: 'POST', cookie: a.cookie }); expect(logout.status).toBe(200);
 expect((await call('/api/config', { cookie: a.cookie })).status).toBe(401);
 expect((await call('/api/config', { cookie: device2.cookie })).status).toBe(200);
 expect((await call('/api/config', { cookie: b.cookie })).status).toBe(200);
 for (const session of mockSessions.values()) session.expiresAt = new Date(0);
 expect((await call('/api/config', { cookie: b.cookie })).status).toBe(401);
});
test('rejects cross-origin writes and limits repeated authentication attempts', async () => {
 expect((await call('/api/auth/login', { method: 'POST', origin: 'https://untrusted.example', body: {} })).status).toBe(403);
 expect((await call('/api/auth/login', { method: 'POST', client: '', body: {} })).status).toBe(403);
 expect((await call('/api/auth/register', { method: 'POST', body: { email: 'test@example.com', password: 'short' } })).status).toBe(400);
 AuthAttempt.findOneAndUpdate.mockResolvedValueOnce({ count: 101 });
 expect((await call('/api/auth/login', { method: 'POST', body: {} })).status).toBe(429);
});
