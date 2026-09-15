'use strict';

/**
 * GET /api/friends/:handle/problems/:contestId/:index/submissions
 *
 * Returns all submissions by a specific tracked handle for a specific problem,
 * with full chronological timeline analytics.
 *
 * Uses { handle: 1, contestId: 1, problemIndex: 1 } compound index (one DB query).
 */

const express    = require('express');
const Submission = require('../models/Submission');
const { computeProblemTimeline } = require('../services/problemService');
const { ALL_HANDLES } = require('../config/handles');

const router = express.Router();

router.get('/:handle/problems/:contestId/:index/submissions', async (req, res) => {
  const { handle } = req.params;

  if (!ALL_HANDLES.includes(handle)) {
    return res.status(404).json({
      error: `Handle '${handle}' is not tracked. Add it to config/handles.js.`
    });
  }

  const contestId = parseInt(req.params.contestId, 10);
  if (isNaN(contestId)) {
    return res.status(400).json({ error: 'contestId must be a number.' });
  }

  const problemIndex = (req.params.index || '').toUpperCase();
  if (!problemIndex) {
    return res.status(400).json({ error: 'Problem index is required.' });
  }

  try {
    // Single query — uses { handle: 1, contestId: 1, problemIndex: 1 } index
    const subs = await Submission
      .find({ handle, contestId, problemIndex })
      .sort({ creationTimeSeconds: 1 })
      .lean();

    // Derive problem metadata from submissions (null if none found)
    const metaSub = subs.find(s => s.problemName) || subs[0] || null;
    const problem = metaSub ? {
      contestId,
      index:  metaSub.problemIndex,
      name:   metaSub.problemName   || null,
      rating: metaSub.problemRating || null,
      tags:   metaSub.tags          || []
    } : null;

    const timeline = computeProblemTimeline(subs);

    res.json({ handle, problem, timeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
