'use strict';

const express    = require('express');
const Submission = require('../models/Submission');
const { computeProblemTimeline } = require('../services/problemService');
const { getTrackerConfig } = require('../services/trackerConfigService');

const router = express.Router();

router.get('/:handle/problems/:contestId/:index/submissions', async (req, res) => {
  const { handle } = req.params;

  const contestId = parseInt(req.params.contestId, 10);
  if (isNaN(contestId)) {
    return res.status(400).json({ error: 'contestId must be a number.' });
  }

  const problemIndex = (req.params.index || '').toUpperCase();
  if (!problemIndex) {
    return res.status(400).json({ error: 'Problem index is required.' });
  }

  try {
    const { allHandles } = await getTrackerConfig();
    const tracked = allHandles.some(h => h.toLowerCase() === String(handle).toLowerCase());
    if (!tracked) {
      return res.status(404).json({
        error: `Handle '${handle}' is not currently tracked. Add it from Settings.`
      });
    }

    const canonicalHandle = allHandles.find(h => h.toLowerCase() === String(handle).toLowerCase()) || handle;
    const subs = await Submission
      .find({ handle: canonicalHandle, contestId, problemIndex })
      .sort({ creationTimeSeconds: 1 })
      .lean();

    const metaSub = subs.find(s => s.problemName) || subs[0] || null;
    const problem = metaSub ? {
      contestId,
      index: metaSub.problemIndex,
      name: metaSub.problemName || null,
      rating: metaSub.problemRating || null,
      tags: metaSub.tags || []
    } : null;

    const timeline = computeProblemTimeline(subs);
    res.json({ handle: canonicalHandle, problem, timeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
