const mongoose = require('mongoose');

const syncStateSchema = new mongoose.Schema({
  handle:                  { type: String, required: true, unique: true },
  lastSyncedSubmissionId:  { type: Number, default: 0 },
  lastSyncAt:              { type: Date, default: null },
  status: {
    type: String,
    default: 'idle',
    enum: ['idle', 'running', 'done', 'error']
  },
  error: { type: String, default: null }
}, { timestamps: false });

module.exports = mongoose.model('SyncState', syncStateSchema);
