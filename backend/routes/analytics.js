'use strict';

const express    = require('express');
const Submission = require('../models/Submission');
const Editorial  = require('../models/Editorial');
const { ME, FRIENDS } = require('../config/handles');
const { computeSkillGaps, generateLearningTargets } = require('../services/skillGapService');
const { computeFriendFingerprint }                  = require('../services/fingerprintService');
const { computeIndependenceSignal }                 = require('../services/evidenceService');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/analytics/skills
// Skill gaps: ME vs all FRIENDS
// ---------------------------------------------------------------------------
router.get('/skills', async (req, res) => {
  try {
    const skillGaps = await computeSkillGaps(ME, FRIENDS);
    res.json({
      myHandle:    ME,
      skillGaps,
      generatedAt: new Date()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/learning
// Learning targets for ME based on gaps vs FRIENDS
// ---------------------------------------------------------------------------
router.get('/learning', async (req, res) => {
  try {
    const targets = await generateLearningTargets(ME, FRIENDS);
    res.json({ targets, generatedAt: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/friends/:handle
// Friend fingerprint
// ---------------------------------------------------------------------------
router.get('/friends/:handle', async (req, res) => {
  const { handle } = req.params;

  try {
    const fingerprint = await computeFriendFingerprint(handle);
    res.json({ fingerprint });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/problems/:contestId/:index/evidence/:handle
// Independence signal for handle+problem
// ---------------------------------------------------------------------------
router.get('/problems/:contestId(\\d+)/:index/evidence/:handle', async (req, res) => {
  const contestId = parseInt(req.params.contestId, 10);
  if (isNaN(contestId)) {
    return res.status(400).json({ error: 'contestId must be a number.' });
  }

  const problemIndex = (req.params.index || '').toUpperCase();
  const { handle }   = req.params;

  try {
    const [subs, editorial] = await Promise.all([
      Submission.find({ handle, contestId, problemIndex }).lean(),
      Editorial.findOne({ contestId }).lean()
    ]);

    const result = computeIndependenceSignal(subs, editorial);

    return res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
