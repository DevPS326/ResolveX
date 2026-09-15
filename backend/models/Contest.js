'use strict';

const mongoose = require('mongoose');

/**
 * Minimal contest record.
 * Name/type can be populated in a future phase via contest.info API.
 * For Phase 2 we only need the contestId to exist as a reference anchor.
 */
const contestSchema = new mongoose.Schema({
  contestId:        { type: Number, required: true, unique: true },
  name:             { type: String, default: null },
  startTimeSeconds: { type: Number, default: null }
}, { timestamps: false });

module.exports = mongoose.model('Contest', contestSchema);
