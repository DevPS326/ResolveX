'use strict';

require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

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
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- Routes ---
app.use('/api/health',   healthRouter);
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

// --- Database ---
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log('[DB] MongoDB connected'))
    .catch(err => console.error('[DB] Connection failed:', err.message));
} else {
  console.warn('[DB] MONGO_URI not set. Database-backed routes will fail.');
}

// --- Start ---
app.listen(PORT, () => {
  console.log(`🚀 CP COMBAT COMMAND active on port ${PORT}`);
});
