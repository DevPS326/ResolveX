'use strict';

/**
 * GET /api/problems/:contestId/:index/friends
 *
 * Returns all tracked users who have at least one submission for the given
 * problem, together with their complete chronological attempt timelines
 * and derived analytics.
 *
 * Uses the { contestId: 1, problemIndex: 1 } index (one DB query, no N+1).
 */

const express    = require('express');
const Submission = require('../models/Submission');
const { computeProblemTimeline, groupSubmissionsByHandle } = require('../services/problemService');
const { ALL_HANDLES } = require('../config/handles');

const router = express.Router();

router.get('/:contestId/:index/friends', async (req, res) => {
  const contestId = parseInt(req.params.contestId, 10);
  if (isNaN(contestId)) {
    return res.status(400).json({ error: 'contestId must be a number.' });
  }

  // Normalise index to uppercase (CF uses A, B, C, D1, D2 …)
  const problemIndex = (req.params.index || '').toUpperCase();
  if (!problemIndex) {
    return res.status(400).json({ error: 'Problem index is required.' });
  }

  try {
    // Single query — uses { contestId: 1, problemIndex: 1 } compound index
    const subs = await Submission
      .find({
        contestId,
        problemIndex,
        handle: { $in: ALL_HANDLES }
      })
      .sort({ creationTimeSeconds: 1 })
      .lean();

    if (subs.length === 0) {
      return res.json({
        contestId,
        problemIndex,
        problem:  null,
        friends:  [],
        message:  'No submissions found for this problem among tracked users.'
      });
    }

    // Derive problem metadata from the first submission that has it
    const metaSub  = subs.find(s => s.problemName) || subs[0];
    const problem  = {
      contestId,
      index:  metaSub.problemIndex,
      name:   metaSub.problemName   || null,
      rating: metaSub.problemRating || null,
      tags:   metaSub.tags          || []
    };

    // Group submissions by handle and compute timeline for each
    const grouped = groupSubmissionsByHandle(subs);
    const friends = Object.entries(grouped).map(([handle, handleSubs]) => ({
      handle,
      ...computeProblemTimeline(handleSubs)
    }));

    // Sort by firstAttemptAt ascending (earliest attempter first)
    friends.sort((a, b) => (a.firstAttemptAt || 0) - (b.firstAttemptAt || 0));

    res.json({ contestId, problemIndex, problem, friends });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
