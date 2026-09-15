const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  handle: { type: String, required: true, unique: true },
  rating: { type: Number, default: 0 },
  rank: { type: String, default: 'unrated' },
  lastOnline: { type: Number, default: 0 },
  syncedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
