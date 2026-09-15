'use strict';

const express = require('express');
const { getTrackerConfig, saveTrackerConfig, MAX_FRIENDS } = require('../services/trackerConfigService');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    res.json(await getTrackerConfig());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  const { meHandle, friends } = req.body || {};

  if (friends != null && !Array.isArray(friends)) {
    return res.status(400).json({ error: 'friends must be an array of Codeforces handles.' });
  }

  if (Array.isArray(friends) && friends.length > MAX_FRIENDS) {
    return res.status(400).json({ error: `You can track at most ${MAX_FRIENDS} friends.` });
  }

  try {
    const config = await saveTrackerConfig(meHandle, friends || []);
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
