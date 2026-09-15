'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const PORT = process.env.PORT || 5000;

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
