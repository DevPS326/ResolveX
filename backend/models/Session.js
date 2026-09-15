const mongoose = require('mongoose');
module.exports = mongoose.model('Session', new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}));
