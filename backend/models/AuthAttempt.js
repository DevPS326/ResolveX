const mongoose = require('mongoose');
module.exports = mongoose.model('AuthAttempt', new mongoose.Schema({
  _id: String,
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 }
}));
