'use strict';

const mongoose = require('mongoose');

const TrackerConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'primary',
    unique: true,
    index: true
  },
  meHandle: {
    type: String,
    required: true,
    trim: true
  },
  friends: {
    type: [String],
    default: []
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('TrackerConfig', TrackerConfigSchema);
