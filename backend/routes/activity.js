'use strict';

const express    = require('express');
const Submission = require('../models/Submission');
const { getTrackerConfig } = require('../services/trackerConfigService');

const router = express.Router();
const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 200;

router.get('/', async (req, res) => {
  try {
    const { allHandles } = await getTrackerConfig(req.accountId);
    if (allHandles.length === 0) return res.json({ count: 0, activity: [] });

    const limitParam = parseInt(req.query.limit, 10);
    const limit = (!isNaN(limitParam) && limitParam > 0)
      ? Math.min(limitParam, MAX_LIMIT)
      : DEFAULT_LIMIT;

    const subs = await Submission
      .find({ handle: { $in: allHandles } })
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
