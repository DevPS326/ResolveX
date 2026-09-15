'use strict';

const express    = require('express');
const Submission = require('../models/Submission');
const Editorial  = require('../models/Editorial');
const { getTrackerConfig } = require('../services/trackerConfigService');
const { computeSkillGaps, generateLearningTargets } = require('../services/skillGapService');
const { computeFriendFingerprint }                  = require('../services/fingerprintService');
const { computeIndependenceSignal }                 = require('../services/evidenceService');

const router = express.Router();

router.get('/skills', async (_req, res) => {
  try {
    const { configured, meHandle, friends } = await getTrackerConfig();
    if (!configured) return res.json({ myHandle: null, skillGaps: [], generatedAt: new Date() });

    const skillGaps = await computeSkillGaps(meHandle, friends);
    res.json({ myHandle: meHandle, skillGaps, generatedAt: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/learning', async (_req, res) => {
  try {
    const { configured, meHandle, friends } = await getTrackerConfig();
    if (!configured) return res.json({ targets: [], generatedAt: new Date() });

    const targets = await generateLearningTargets(meHandle, friends);
    res.json({ targets, generatedAt: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/friends/:handle', async (req, res) => {
  const { handle } = req.params;

  try {
    const fingerprint = await computeFriendFingerprint(handle);
    res.json({ fingerprint });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/problems/:contestId(\\d+)/:index/evidence/:handle', async (req, res) => {
  const contestId = parseInt(req.params.contestId, 10);
  if (isNaN(contestId)) {
    return res.status(400).json({ error: 'contestId must be a number.' });
  }

  const problemIndex = (req.params.index || '').toUpperCase();
  const { handle } = req.params;

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
