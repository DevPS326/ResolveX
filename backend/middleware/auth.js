const Session = require('../models/Session');
const { sessionToken, hashToken } = require('../services/authService');
async function requireAccount(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  const token = sessionToken(req);
  if (!token) return res.status(401).json({ error: 'Please sign in to your account.' });
  try {
    const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
    if (!session) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    req.accountId = String(session.accountId);
    next();
  } catch (err) { next(err); }
}
module.exports = { requireAccount };
