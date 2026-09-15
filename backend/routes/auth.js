const express = require('express');
const Account = require('../models/Account');
const Session = require('../models/Session');
const AuthAttempt = require('../models/AuthAttempt');
const { requireAccount } = require('../middleware/auth');
const { hashPassword, verifyPassword, hashToken, sessionToken, issueSession, cookieOptions, COOKIE } = require('../services/authService');
const router = express.Router();
const WINDOW = 15 * 60 * 1000;
// Persist limits across process restarts; only hashed identifiers are stored.
async function limitAttempts(req, res, next) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const window = Math.floor(Date.now() / WINDOW);
    for (const [key, max] of [[`ip:${req.ip}`, 100], [`email:${email}`, 15]]) {
      const attempt = await AuthAttempt.findOneAndUpdate(
        { _id: hashToken(`${window}:${key}`) },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 1) * WINDOW) } },
        { upsert: true, new: true }
      );
      if (attempt.count > max) {
        res.set('Retry-After', String(Math.ceil(((window + 1) * WINDOW - Date.now()) / 1000)));
        return res.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' });
      }
    }
    next();
  } catch (err) { next(err); }
}
function credentials(req) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return null;
  if (typeof password !== 'string' || password.length > 128 || !password.length) return null;
  return { email: email.trim().toLowerCase(), password };
}
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.post('/register', limitAttempts, async (req, res, next) => {
  const input = credentials(req);
  if (!input || input.password.length < 12) return res.status(400).json({ error: 'Enter a valid email and a password of 12–128 characters.' });
  try {
    const passwordHash = await hashPassword(input.password);
    const account = await Account.create({ email: input.email, passwordHash });
    await issueSession(req, res, account._id);
    res.status(201).json({ account: { email: account.email } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'An account already exists for this email. Please sign in.' });
    next(err);
  }
});
router.post('/login', limitAttempts, async (req, res, next) => {
  const input = credentials(req);
  if (!input) return res.status(400).json({ error: 'Enter your email and password.' });
  try {
    const account = await Account.findOne({ email: input.email }).select('+passwordHash').lean();
    // Do equivalent password work for unknown accounts.
    const valid = account ? await verifyPassword(input.password, account.passwordHash) : (await hashPassword(input.password), false);
    if (!valid) return res.status(401).json({ error: 'Email or password is incorrect.' });
    await issueSession(req, res, account._id);
    res.json({ account: { email: account.email } });
  } catch (err) { next(err); }
});
router.get('/me', requireAccount, async (req, res, next) => {
  try {
    const account = await Account.findById(req.accountId).lean();
    if (!account) return res.status(401).json({ error: 'Please sign in again.' });
    res.json({ account: { email: account.email } });
  } catch (err) { next(err); }
});
router.post('/logout', async (req, res, next) => {
  try {
    const token = sessionToken(req);
    if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
    res.clearCookie(COOKIE, cookieOptions());
    res.json({ ok: true });
  } catch (err) { next(err); }
});
module.exports = router;
