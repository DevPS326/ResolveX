const { randomBytes, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const Session = require('../models/Session');
const deriveKey = promisify(scrypt);
const COOKIE = 'resolvex_session';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const hashToken = token => createHash('sha256').update(token).digest('hex');
const passwordOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 64, passwordOptions);
  return `${salt}:${key.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [salt, expected] = (stored || '').split(':');
  if (!salt || !expected) return false;
  const key = await deriveKey(password, salt, 64, passwordOptions);
  const digest = Buffer.from(expected, 'hex');
  return key.length === digest.length && timingSafeEqual(key, digest);
}
function sessionToken(req) {
  const value = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`));
  const token = value ? value.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER), sameSite: 'lax', path: '/' };
}
async function issueSession(req, res, accountId) {
  const previous = sessionToken(req);
  if (previous) await Session.deleteOne({ tokenHash: hashToken(previous) });
  const token = randomBytes(32).toString('hex');
  await Session.create({ tokenHash: hashToken(token), accountId, expiresAt: new Date(Date.now() + SESSION_MS) });
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MS });
}
module.exports = { hashPassword, verifyPassword, hashToken, sessionToken, issueSession, cookieOptions, COOKIE };
