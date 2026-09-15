'use strict';

/**
 * GET /api/rivals
 * Returns all tracked friends with rating, rank, last-online, and 7-day velocity.
 * Served entirely from the local DB — no live CF API calls.
 */

const express    = require('express');
const Submission = require('../models/Submission');
const User       = require('../models/User');
const { FRIENDS } = require('../config/handles');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Fetch stored user profiles for all tracked friends
    const users = await User.find({ handle: { $in: FRIENDS } }).lean();

    // Compute 7-day velocity (distinct accepted problems per handle) via one aggregation
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const velocityAgg = await Submission.aggregate([
      {
        $match: {
          handle:              { $in: FRIENDS },
          verdict:             'OK',
          creationTimeSeconds: { $gte: sevenDaysAgo }
        }
      },
      { $group: { _id: '$handle', velocity: { $sum: 1 } } }
    ]);

    const velocityMap = {};
    velocityAgg.forEach(v => { velocityMap[v._id] = v.velocity; });

    // Build user map for O(1) lookup
    const userMap = {};
    users.forEach(u => { userMap[u.handle] = u; });

    const rivals = FRIENDS.map(handle => {
      const u = userMap[handle];
      return {
        handle,
        rating:     u ? u.rating    : null,
        rank:       u ? u.rank      : null,
        lastOnline: u ? u.lastOnline : null,
        velocity:   velocityMap[handle] || 0,
        syncedAt:   u ? u.syncedAt  : null
      };
    });

    // Sort by velocity descending (most active first), then rating
    rivals.sort((a, b) => b.velocity - a.velocity || (b.rating || 0) - (a.rating || 0));

    res.json({ rivals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
