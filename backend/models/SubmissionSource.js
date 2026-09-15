'use strict';

const mongoose = require('mongoose');

const submissionSourceSchema = new mongoose.Schema({
  submissionId:     { type: Number, required: true, unique: true },
  handle:           { type: String, default: null },
  source:           { type: String, default: null },
  normalizedSource: { type: String, default: null },
  hash:             { type: String, default: null },
  language:         { type: String, default: null },
  fetchStatus: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'NOT_AVAILABLE', 'BLOCKED', 'PARSE_ERROR', 'ERROR'],
    default: 'PENDING'
  },
  fetchedAt:   { type: Date,   default: null },
  fetchError:  { type: String, default: null },
  fetchedUrl:  { type: String, default: null }
}, { timestamps: false });

submissionSourceSchema.index({ hash: 1 });
submissionSourceSchema.index({ submissionId: 1 }, { unique: true });

module.exports = mongoose.model('SubmissionSource', submissionSourceSchema);
