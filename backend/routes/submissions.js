'use strict';

const express          = require('express');
const Submission       = require('../models/Submission');
const SubmissionSource = require('../models/SubmissionSource');
const { fetchSubmissionSource, normalizeSource, hashSource } = require('../services/sourceAdapter');
const { generateDiff } = require('../services/diffService');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/submissions/:submissionId
// Return Submission metadata (for context when viewing source)
// ---------------------------------------------------------------------------
router.get('/:submissionId(\\d+)', async (req, res) => {
  const submissionId = parseInt(req.params.submissionId, 10);
  if (isNaN(submissionId)) {
    return res.status(400).json({ error: 'submissionId must be a number.' });
  }

  try {
    const sub = await Submission.findOne({ submissionId }).lean();
    if (!sub) {
      return res.status(404).json({ error: `Submission ${submissionId} not found.` });
    }
    res.json(sub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/submissions/:submissionId/source
// Fetch or return cached source code for a submission
// ---------------------------------------------------------------------------
router.get('/:submissionId(\\d+)/source', async (req, res) => {
  const submissionId = parseInt(req.params.submissionId, 10);
  if (isNaN(submissionId)) {
    return res.status(400).json({ error: 'submissionId must be a number.' });
  }

  try {
    // Check cache
    const cached = await SubmissionSource.findOne({ submissionId }).lean();

    if (cached) {
      const terminalStatuses = ['SUCCESS', 'NOT_AVAILABLE', 'BLOCKED'];
      if (terminalStatuses.includes(cached.fetchStatus)) {
        return res.json({
          submissionId:  cached.submissionId,
          fetchStatus:   cached.fetchStatus,
          source:        cached.fetchStatus === 'SUCCESS' ? cached.source : null,
          hash:          cached.hash,
          language:      cached.language,
          fetchedAt:     cached.fetchedAt,
          fetchError:    cached.fetchError
        });
      }
      // PARSE_ERROR or ERROR → fall through and retry
    }

    // Find the Submission record for contestId and language
    const sub = await Submission.findOne({ submissionId }).lean();
    const contestId = sub ? sub.contestId : null;
    const language  = sub ? sub.programmingLanguage : null;

    // Perform the fetch
    const result = await fetchSubmissionSource(submissionId, contestId);

    const normalized = result.status === 'SUCCESS'
      ? normalizeSource(result.source)
      : null;

    const hash = normalized ? hashSource(normalized) : null;

    // Upsert SubmissionSource
    const update = {
      submissionId,
      handle:           sub ? sub.handle : null,
      source:           result.status === 'SUCCESS' ? result.source : null,
      normalizedSource: normalized,
      hash,
      language,
      fetchStatus:      result.status,
      fetchedAt:        result.status === 'SUCCESS' ? new Date() : null,
      fetchError:       result.reason || null,
      fetchedUrl:       result.fetchedUrl
    };

    await SubmissionSource.findOneAndUpdate(
      { submissionId },
      { $set: update },
      { upsert: true, new: true }
    );

    return res.json({
      submissionId,
      fetchStatus: result.status,
      source:      result.status === 'SUCCESS' ? result.source : null,
      hash,
      language,
      fetchedAt:   update.fetchedAt,
      fetchError:  update.fetchError
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/submissions/diff/:id1/:id2
// Diff two submission sources
// ---------------------------------------------------------------------------
router.get('/diff/:id1(\\d+)/:id2(\\d+)', async (req, res) => {
  const id1 = parseInt(req.params.id1, 10);
  const id2 = parseInt(req.params.id2, 10);

  if (isNaN(id1) || isNaN(id2)) {
    return res.status(400).json({ error: 'Both submissionIds must be numbers.' });
  }

  try {
    const [src1, src2] = await Promise.all([
      SubmissionSource.findOne({ submissionId: id1 }).lean(),
      SubmissionSource.findOne({ submissionId: id2 }).lean()
    ]);

    if (!src1 || src1.fetchStatus !== 'SUCCESS') {
      return res.status(422).json({
        error: `Source for submission ${id1} is not available (status: ${src1 ? src1.fetchStatus : 'not found'}).`
      });
    }

    if (!src2 || src2.fetchStatus !== 'SUCCESS') {
      return res.status(422).json({
        error: `Source for submission ${id2} is not available (status: ${src2 ? src2.fetchStatus : 'not found'}).`
      });
    }

    const diff = generateDiff(src1.normalizedSource, src2.normalizedSource, String(id1), String(id2));

    return res.json({
      submissionId1: id1,
      submissionId2: id2,
      identical:     diff.identical,
      additions:     diff.additions,
      deletions:     diff.deletions,
      changed:       diff.changed,
      patch:         diff.patch
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
