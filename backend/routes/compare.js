'use strict';

const express = require('express');
const axios   = require('axios');
const { getTrackerConfig } = require('../services/trackerConfigService');

const router = express.Router();
const delay = ms => new Promise(r => setTimeout(r, ms));

const analyzeUser = async (handle) => {
  try {
    const [statusRes, infoRes] = await Promise.all([
      axios.get(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}`),
      axios.get(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`)
    ]);

    const solved = new Map();
    const tagStats = {};
    let velocity = 0;
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);

    statusRes.data.result.forEach(sub => {
      if (sub.verdict === 'OK') {
        const p = sub.problem;
        const id = `${p.contestId}${p.index}`;
        solved.set(id, {
          id, contestId: p.contestId, index: p.index,
          name: p.name, rating: p.rating, tags: p.tags
        });
        (p.tags || []).forEach(t => { tagStats[t] = (tagStats[t] || 0) + 1; });
        if (sub.creationTimeSeconds > sevenDaysAgo) velocity++;
      }
    });

    const info = infoRes.data.result[0];
    return {
      handle,
      solved,
      tagStats,
      velocity,
      rating: info.rating || 0,
      rank: info.rank || 'unrated',
      lastOnline: info.lastOnlineTimeSeconds
    };
  } catch (_e) {
    return { handle, solved: new Map(), tagStats: {}, velocity: 0, lastOnline: 0 };
  }
};

router.get('/', async (_req, res) => {
  try {
    const { configured, meHandle, friends } = await getTrackerConfig();
    if (!configured) {
      return res.status(400).json({ error: 'Tracker setup is required first.' });
    }

    const meData = await analyzeUser(meHandle);
    const friendsData = [];

    for (const f of friends) {
      const d = await analyzeUser(f);
      friendsData.push(d);
      await delay(350);
    }

    const missedMap = new Map();
    const allTagsAcrossFriends = new Set();

    friendsData.forEach(f => {
      f.solved.forEach((prob, id) => {
        if (!meData.solved.has(id) && prob.rating) {
          if (!missedMap.has(id)) {
            missedMap.set(id, { ...prob, count: 1, rivals: [f.handle] });
          } else {
            const entry = missedMap.get(id);
            entry.count += 1;
            if (!entry.rivals.includes(f.handle)) entry.rivals.push(f.handle);
          }
        }
        prob.tags.forEach(t => allTagsAcrossFriends.add(t));
      });
    });

    const categorized = {
      newbie: [], pupil: [], specialist: [], expert: [],
      candidateMaster: [], master: [], intMaster: [], grandmaster: []
    };

    Array.from(missedMap.values()).forEach(p => {
      if      (p.rating < 1200) categorized.newbie.push(p);
      else if (p.rating < 1400) categorized.pupil.push(p);
      else if (p.rating < 1600) categorized.specialist.push(p);
      else if (p.rating < 1900) categorized.expert.push(p);
      else if (p.rating < 2100) categorized.candidateMaster.push(p);
      else if (p.rating < 2300) categorized.master.push(p);
      else if (p.rating < 2400) categorized.intMaster.push(p);
      else                      categorized.grandmaster.push(p);
    });

    Object.keys(categorized).forEach(k => {
      categorized[k] = categorized[k]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    });

    res.json({
      me: {
        handle: meHandle,
        solvedCount: meData.solved.size,
        myTags: meData.tagStats,
        rating: meData.rating
      },
      categorized,
      allAvailableTags: Array.from(allTagsAcrossFriends).sort(),
      rivals: friendsData.map(f => ({
        handle: f.handle,
        rating: f.rating,
        rank: f.rank,
        lastOnline: f.lastOnline,
        velocity: f.velocity
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Tactical Error: API Limit Hit' });
  }
});

module.exports = router;
