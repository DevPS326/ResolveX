'use strict';

/**
 * GET /api/activity[?limit=N]
 * Returns the most recent submissions across all tracked users (including ME).
 * Served from local DB. Default limit 50, max 200.
 */

const express    = require('express');
const Submission = require('../models/Submission');
const { ALL_HANDLES } = require('../config/handles');

const router = express.Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 200;

router.get('/', async (req, res) => {
  try {
    const limitParam = parseInt(req.query.limit, 10);
    const limit = (!isNaN(limitParam) && limitParam > 0)
      ? Math.min(limitParam, MAX_LIMIT)
      : DEFAULT_LIMIT;

    // Uses { creationTimeSeconds: -1 } index added in Phase 2
    const subs = await Submission
      .find({ handle: { $in: ALL_HANDLES } })
      .sort({ creationTimeSeconds: -1 })
      .limit(limit)
      .lean();

    const activity = subs.map(s => ({
      submissionId:        s.submissionId,
      handle:              s.handle,
      contestId:           s.contestId,
      problemIndex:        s.problemIndex,
      problemName:         s.problemName,
      problemRating:       s.problemRating,
      tags:                s.tags,
      verdict:             s.verdict,
      creationTimeSeconds: s.creationTimeSeconds,
      programmingLanguage: s.programmingLanguage,
      submissionUrl:       s.submissionUrl
    }));

    res.json({ count: activity.length, activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
