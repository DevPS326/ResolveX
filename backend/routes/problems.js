'use strict';

const express    = require('express');
const Submission = require('../models/Submission');
const { computeProblemTimeline, groupSubmissionsByHandle } = require('../services/problemService');
const { getTrackerConfig } = require('../services/trackerConfigService');

const router = express.Router();

router.get('/:contestId/:index/friends', async (req, res) => {
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
    if (allHandles.length === 0) {
      return res.json({ contestId, problemIndex, problem: null, friends: [] });
    }

    const subs = await Submission
      .find({ contestId, problemIndex, handle: { $in: allHandles } })
      .sort({ creationTimeSeconds: 1 })
      .lean();

    if (subs.length === 0) {
      return res.json({
        contestId,
        problemIndex,
        problem: null,
        friends: [],
        message: 'No submissions found for this problem among tracked users.'
      });
    }

    const metaSub = subs.find(s => s.problemName) || subs[0];
    const problem = {
      contestId,
      index: metaSub.problemIndex,
      name: metaSub.problemName || null,
      rating: metaSub.problemRating || null,
      tags: metaSub.tags || []
    };

    const grouped = groupSubmissionsByHandle(subs);
    const friends = Object.entries(grouped).map(([handle, handleSubs]) => ({
      handle,
      ...computeProblemTimeline(handleSubs)
    }));

    friends.sort((a, b) => (a.firstAttemptAt || 0) - (b.firstAttemptAt || 0));
    res.json({ contestId, problemIndex, problem, friends });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
