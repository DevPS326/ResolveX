'use strict';

const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema({
  contestId: { type: Number, required: true },
  index:     { type: String, required: true },
  name:      { type: String, default: null },
  rating:    { type: Number, default: null },
  tags:      [{ type: String }],
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: false });

problemSchema.index({ contestId: 1, index: 1 }, { unique: true });

module.exports = mongoose.model('Problem', problemSchema);
