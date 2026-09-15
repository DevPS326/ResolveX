const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  submissionId:        { type: Number, required: true, unique: true },
  handle:              { type: String, required: true },
  contestId:           { type: Number, default: null },
  problemIndex:        { type: String, default: null },
  problemName:         { type: String, default: null },
  problemRating:       { type: Number, default: null },
  tags:                [{ type: String }],
  verdict:             { type: String, default: 'UNKNOWN' },
  programmingLanguage: { type: String, default: null },
  creationTimeSeconds: { type: Number, default: null },
  relativeTimeSeconds: { type: Number, default: null },
  submissionUrl:       { type: String, default: null },
  sourceAvailable:     { type: Boolean, default: false },
  sourceFetchStatus:   { type: String, default: 'PENDING' }
}, { timestamps: false });

submissionSchema.index({ handle: 1, creationTimeSeconds: -1 });
submissionSchema.index({ handle: 1, contestId: 1, problemIndex: 1 });
submissionSchema.index({ contestId: 1, problemIndex: 1 });
// Supports GET /api/activity: find most recent submissions across all handles
submissionSchema.index({ creationTimeSeconds: -1 });

module.exports = mongoose.model('Submission', submissionSchema);
