const express  = require('express');
const cors     = require('cors');
const { requireAccount } = require('./middleware/auth');
const authRouter = require('./routes/auth');

const healthRouter      = require('./routes/health');
const configRouter      = require('./routes/config');
const syncRouter        = require('./routes/sync');
const compareRouter     = require('./routes/compare');
const rivalsRouter      = require('./routes/rivals');
const activityRouter    = require('./routes/activity');
const problemsRouter    = require('./routes/problems');
const friendsRouter     = require('./routes/friends');
const submissionsRouter = require('./routes/submissions');
const editorialsRouter  = require('./routes/editorials');
const analyticsRouter   = require('./routes/analytics');

const app  = express();
app.set('trust proxy', 1);
const allowedOrigins = new Set([
  'https://resolvex-eight.vercel.app',
  ...(process.env.APP_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  ...(process.env.NODE_ENV !== 'production' && !process.env.RENDER ? ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'] : [])
]);

app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true }));
app.use(express.json({ limit: '16kb' }));
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.get('X-ResolveX-Client') !== 'web' || (req.get('Origin') && !allowedOrigins.has(req.get('Origin')))) {
      return res.status(403).json({ error: 'This request is not allowed.' });
    }
  }
  next();
});

// --- Routes ---
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use(['/api', '/compare-all'], requireAccount);
app.use('/api/config',   configRouter);
app.use('/api/sync',     syncRouter);
app.use('/api/rivals',   rivalsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/problems', problemsRouter);
app.use('/api/friends',  friendsRouter);
app.use('/compare-all',  compareRouter);  // Legacy endpoint preserved
app.use('/api/submissions', submissionsRouter);
app.use('/api/editorials',  editorialsRouter);
app.use('/api/analytics',   analyticsRouter);


app.use((err, _req, res, _next) => {
  console.error('[request]', err.name);
  res.status(err.status === 413 ? 413 : 500).json({ error: err.status === 413 ? 'Request is too large.' : 'Something went wrong. Please try again.' });
});
module.exports = app;
