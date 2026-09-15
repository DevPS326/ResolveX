'use strict';

const express    = require('express');
const Submission = require('../models/Submission');
const User       = require('../models/User');
const { getTrackerConfig } = require('../services/trackerConfigService');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const { friends } = await getTrackerConfig();
    if (friends.length === 0) return res.json({ rivals: [] });

    const users = await User.find({ handle: { $in: friends } }).lean();
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const velocityAgg = await Submission.aggregate([
      {
        $match: {
          handle:              { $in: friends },
          verdict:             'OK',
          creationTimeSeconds: { $gte: sevenDaysAgo }
        }
      },
      { $group: { _id: '$handle', velocity: { $sum: 1 } } }
    ]);

    const velocityMap = {};
    velocityAgg.forEach(v => { velocityMap[v._id] = v.velocity; });

    const userMap = {};
    users.forEach(u => { userMap[u.handle] = u; });

    const rivals = friends.map(handle => {
      const u = userMap[handle];
      return {
        handle,
        rating:     u ? u.rating : null,
        rank:       u ? u.rank : null,
        lastOnline: u ? u.lastOnline : null,
        velocity:   velocityMap[handle] || 0,
        syncedAt:   u ? u.syncedAt : null
      };
    });

    rivals.sort((a, b) => b.velocity - a.velocity || (b.rating || 0) - (a.rating || 0));
    res.json({ rivals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
