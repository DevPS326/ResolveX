'use strict';

const express    = require('express');
const Submission = require('../models/Submission');
const Editorial  = require('../models/Editorial');
const {
  getEditorialForContest,
  setEditorialManually,
  getEditorialByBlogEntry,
  computeEditorialTiming
} = require('../services/editorialService');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/editorials/:contestId
// Return Editorial record for a contest, or { editorialAvailable: false }
// ---------------------------------------------------------------------------
router.get('/:contestId(\\d+)', async (req, res) => {
  const contestId = parseInt(req.params.contestId, 10);
  if (isNaN(contestId)) {
    return res.status(400).json({ error: 'contestId must be a number.' });
  }

  try {
    const editorial = await getEditorialForContest(contestId);
    if (!editorial) {
      return res.json({ contestId, editorialAvailable: false });
    }
    return res.json(editorial);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/editorials/:contestId
// Manually register editorial
// Body: { editorialUrl, blogEntryId?, availableAt?, title? }
// ---------------------------------------------------------------------------
router.post('/:contestId(\\d+)', async (req, res) => {
  const contestId = parseInt(req.params.contestId, 10);
  if (isNaN(contestId)) {
    return res.status(400).json({ error: 'contestId must be a number.' });
  }

  const { editorialUrl, blogEntryId, availableAt, title } = req.body || {};

  try {
    // If blogEntryId provided, try to fetch timestamp from CF API
    let resolvedAvailableAt = availableAt || null;
    let resolvedTitle       = title       || null;

    if (blogEntryId) {
      const blogData = await getEditorialByBlogEntry(blogEntryId);
      if (blogData) {
        if (!resolvedAvailableAt && blogData.creationTime) {
          resolvedAvailableAt = new Date(blogData.creationTime * 1000);
        }
        if (!resolvedTitle && blogData.title) {
          resolvedTitle = blogData.title;
        }
      }
    }

    const editorial = await setEditorialManually(contestId, {
      editorialUrl,
      blogEntryId,
      availableAt: resolvedAvailableAt,
      title:       resolvedTitle
    });

    return res.status(201).json(editorial);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/editorials/:contestId/timing/:handle/:index
// Compare editorial availability vs. friend's submissions for this problem
// ---------------------------------------------------------------------------
router.get('/:contestId(\\d+)/timing/:handle/:index', async (req, res) => {
  const contestId = parseInt(req.params.contestId, 10);
  if (isNaN(contestId)) {
    return res.status(400).json({ error: 'contestId must be a number.' });
  }

  const { handle, index } = req.params;
  const problemIndex = index.toUpperCase();

  try {
    const [editorial, subs] = await Promise.all([
      Editorial.findOne({ contestId }).lean(),
      Submission.find({ handle, contestId, problemIndex }).lean()
    ]);

    const editorialAvailableAt = editorial && editorial.availableAt
      ? editorial.availableAt
      : null;

    const timing = computeEditorialTiming(editorialAvailableAt, subs);

    return res.json(timing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
